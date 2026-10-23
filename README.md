# SaNi Tech Business Manager

Multi-tenant business management SaaS for businesses in Zambia. The repository is being migrated incrementally to an npm-workspaces monorepo.

## Get started

1. Install dependencies

   ```bash
   npm ci
   ```

2. Start the app

   ```bash
   npm run start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

The Expo application is in `apps/mobile` and uses Expo Router. Shared, cross-platform code belongs in `packages/shared`.

## Verification

Run lint, type-check, unit tests, doctor, and formatting checks with:

```bash
npm run verify
```

## Deployment & Production Builds

### 1. Web Deployment

Build the static web distribution to `apps/mobile/dist`:

```bash
npm run build:web
```

The output can be deployed to any static host (Vercel, Cloudflare Pages, Netlify, or EAS Hosting).

### 2. Mobile App Deployment (Android & iOS with EAS)

The project includes EAS configuration (`eas.json`) with development, preview, and production profiles:

- **EAS CLI**: Run with `npx eas-cli@latest <command>`
- **Build Direct Android APK (Downloadable directly on Android phones)**:
  ```bash
  npx eas-cli@latest build --platform android --profile preview
  ```
  *Produces an installable `.apk` file with a QR code and direct download link.*
- **Build iOS (Internal / TestFlight)**:
  ```bash
  npx eas-cli@latest build --platform ios --profile preview
  ```
- **Build iOS Simulator**:
  ```bash
  npx eas-cli@latest build --platform ios --profile preview-simulator
  ```
- **Build Production Apps (Google Play AAB & App Store IPA)**:
  ```bash
  npx eas-cli@latest build --platform all --profile production
  ```
- **Submit to App Stores**:
  ```bash
  npx eas-cli@latest submit --platform all
  ```

See [development setup](docs/development.md) for environment, tooling, and verification details.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
