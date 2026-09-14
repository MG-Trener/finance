import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const ANON_KEY=Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_ADMIN_API_KEY=Deno.env.get('OPENAI_ADMIN_API_KEY')||'';
const OPENAI_TREASURER_PROJECT_ID=Deno.env.get('OPENAI_TREASURER_PROJECT_ID')||'';

const CORS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'POST, OPTIONS'
};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...CORS,'Content-Type':'application/json','Connection':'keep-alive'}});

function safeTimezone(value:string){
  const zone=value&&value.length<80?value:'Asia/Almaty';
  try{new Intl.DateTimeFormat('en-US',{timeZone:zone}).format(new Date());return zone}catch{return'Asia/Almaty'}
}
function partsInZone(date:Date,timeZone:string){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get=(type:string)=>parts.find(p=>p.type===type)?.value||'';
  return{year:+get('year'),month:+get('month'),day:+get('day')};
}
function zonedMidnightUtcSeconds(year:number,month:number,day:number,timeZone:string){
  // Convert local midnight to UTC by comparing the requested wall-clock date with a UTC guess.
  const guess=new Date(Date.UTC(year,month-1,day,0,0,0));
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const wall=formatter.formatToParts(guess);
  const get=(type:string)=>Number(wall.find(p=>p.type===type)?.value||0);
  const renderedUtc=Date.UTC(get('year'),get('month')-1,get('day'),get('hour'),get('minute'),get('second'));
  const offset=renderedUtc-guess.getTime();
  return Math.floor((guess.getTime()-offset)/1000);
}
function roundMoney(value:number){return Math.round((Number(value)||0)*10000)/10000}

async function openAiCosts(startTime:number,endTime:number){
  if(!OPENAI_ADMIN_API_KEY)throw new Error('ADMIN_KEY_REQUIRED');
  let total=0;
  let nextPage='';
  let guard=0;
  do{
    const params=new URLSearchParams({
      start_time:String(startTime),
      end_time:String(endTime),
      bucket_width:'1d',
      limit:'180'
    });
    if(nextPage)params.set('page',nextPage);
    if(OPENAI_TREASURER_PROJECT_ID)params.append('project_ids[]',OPENAI_TREASURER_PROJECT_ID);
    const response=await fetch(`https://api.openai.com/v1/organization/costs?${params.toString()}`,{
      headers:{Authorization:`Bearer ${OPENAI_ADMIN_API_KEY}`}
    });
    const text=await response.text();
    let payload:any={};try{payload=text?JSON.parse(text):{}}catch{payload={}}
    if(!response.ok){
      console.error('OpenAI costs failed',response.status,payload?.error?.message||text.slice(0,300));
      const error:any=new Error(response.status===401||response.status===403?'ADMIN_KEY_INVALID':'COSTS_UNAVAILABLE');
      error.status=response.status;throw error;
    }
    for(const bucket of payload?.data||[]){
      for(const result of bucket?.results||[]){
        if(String(result?.amount?.currency||'usd').toLowerCase()==='usd')total+=Number(result?.amount?.value||0);
      }
    }
    nextPage=payload?.has_more&&payload?.next_page?String(payload.next_page):'';
    guard++;
  }while(nextPage&&guard<20);
  return roundMoney(total);
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
  if(req.method!=='POST')return json({ok:false,error:'METHOD_NOT_ALLOWED'},405);

  const auth=req.headers.get('Authorization')||'';
  const userClient=createClient(SUPABASE_URL,ANON_KEY,{global:{headers:{Authorization:auth}}});
  const {data:{user},error:userError}=await userClient.auth.getUser();
  if(userError||!user)return json({ok:false,error:'UNAUTHORIZED'},401);

  const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:membership,error:membershipError}=await admin.from('family_users').select('family_id').eq('user_id',user.id).limit(1).maybeSingle();
  if(membershipError)return json({ok:false,error:'FAMILY_LOOKUP_FAILED'},500);
  if(!membership?.family_id)return json({ok:false,error:'NO_FAMILY_ACCESS'},403);
  const familyId=String(membership.family_id);

  let body:any={};try{body=await req.json()}catch{body={}}
  const action=String(body?.action||'status');
  const timeZone=safeTimezone(String(body?.timezone||'Asia/Almaty'));

  if(action==='save_funding'){
    const funded=Number(body?.funded_usd);
    const started=new Date(String(body?.tracking_started_at||''));
    if(!Number.isFinite(funded)||funded<0||funded>100000)return json({ok:false,error:'INVALID_FUNDED_AMOUNT'},400);
    if(Number.isNaN(started.getTime()))return json({ok:false,error:'INVALID_START_DATE'},400);
    const {error}=await admin.from('treasurer_api_settings').upsert({
      family_id:familyId,
      funded_usd:roundMoney(funded),
      tracking_started_at:started.toISOString(),
      updated_at:new Date().toISOString(),
      updated_by:user.id
    },{onConflict:'family_id'});
    if(error)return json({ok:false,error:'SAVE_FAILED',message:error.message},500);
  }

  let {data:settings,error:settingsError}=await admin.from('treasurer_api_settings').select('funded_usd,tracking_started_at,updated_at').eq('family_id',familyId).maybeSingle();
  if(settingsError)return json({ok:false,error:'SETTINGS_FAILED'},500);
  if(!settings){
    settings={funded_usd:0,tracking_started_at:new Date().toISOString(),updated_at:null};
  }

  const funded=roundMoney(Number(settings.funded_usd||0));
  const trackingStarted=new Date(settings.tracking_started_at||Date.now());
  const now=new Date();
  const nowSeconds=Math.floor(now.getTime()/1000);
  const trackingSeconds=Math.max(0,Math.floor(trackingStarted.getTime()/1000));
  const local=partsInZone(now,timeZone);
  const todayStart=zonedMidnightUtcSeconds(local.year,local.month,local.day,timeZone);
  const monthStart=zonedMidnightUtcSeconds(local.year,local.month,1,timeZone);

  const base={
    ok:true,
    funded_usd:funded,
    tracking_started_at:trackingStarted.toISOString(),
    updated_at:settings.updated_at||null,
    currency:'usd',
    project_filter:OPENAI_TREASURER_PROJECT_ID||null,
    costs_available:Boolean(OPENAI_ADMIN_API_KEY)
  };

  if(!OPENAI_ADMIN_API_KEY){
    return json({...base,error:'ADMIN_KEY_REQUIRED',message:'Для точной статистики расходов нужен OpenAI Admin API key.'});
  }

  try{
    const [spentTotal,spentMonth,spentToday]=await Promise.all([
      openAiCosts(trackingSeconds,nowSeconds),
      openAiCosts(Math.max(trackingSeconds,monthStart),nowSeconds),
      openAiCosts(Math.max(trackingSeconds,todayStart),nowSeconds)
    ]);
    return json({
      ...base,
      costs_available:true,
      spent_total_usd:spentTotal,
      spent_month_usd:spentMonth,
      spent_today_usd:spentToday,
      estimated_balance_usd:roundMoney(funded-spentTotal),
      fetched_at:now.toISOString()
    });
  }catch(error:any){
    const code=error?.message==='ADMIN_KEY_INVALID'?'ADMIN_KEY_INVALID':'COSTS_UNAVAILABLE';
    return json({...base,costs_available:false,error:code,message:code==='ADMIN_KEY_INVALID'?'OpenAI Admin API key не подходит или не имеет доступа к Usage.':'Не удалось получить расходы OpenAI.'});
  }
});
