# Google Play readiness — Семейная казна

## Android identity

- App name: `Семейная казна`
- Application ID / package name: `kz.mgtrener.familyfinance`
- Publishing format: Android App Bundle (`.aab`)
- Target API: Android 16 / API 36
- Test APK: published automatically to GitHub Release tag `latest-apk`

## Public policy URLs

- Privacy policy: `https://mg-trener.github.io/finance/privacy.html`
- Account deletion: `https://mg-trener.github.io/finance/delete-account.html`

The app also contains an authenticated deletion-request flow in `Ещё → Доступ → Удаление аккаунта`.

## Release signing

Do not use the repository debug key for Google Play production.

Create a private upload keystore and store it only in GitHub Actions secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

When all four secrets are configured, `.github/workflows/android-apk.yml` builds both:

- signed release APK;
- signed release AAB at `android/app/build/outputs/bundle/release/app-release.aab`.

The AAB is uploaded as the GitHub Actions artifact `family-treasury-play-aab`.

## Play Console setup checklist

1. Create and verify a Google Play Console developer account.
2. Create app with package name `kz.mgtrener.familyfinance`.
3. Enable Play App Signing.
4. Fill store listing and upload screenshots/icon/feature graphic.
5. Add privacy policy URL.
6. Complete Data safety accurately for Supabase Auth, cloud storage and local offline storage.
7. Provide reviewer credentials/instructions because the app is invite-only.
8. Complete app access, content rating, target audience, ads and data-deletion declarations.
9. Upload the signed AAB to Internal testing first.
10. For a new personal developer account created after 13 Nov 2023, run Closed testing with at least 12 opted-in testers continuously for at least 14 days before requesting Production access.

## Data safety notes

The app stores user-entered household finance data, email/authentication data, family participant names, budgets, goals, recurring payments and categories. It does not request bank-card numbers, online-banking credentials, contacts, precise location, camera or microphone access. There are no advertising SDKs in the current app.

Supabase is used for authentication, database storage and realtime synchronization. Offline snapshots and queued changes are stored locally on the device.
