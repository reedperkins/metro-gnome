# Metro Gnome

A metronome app built with Vue 3 + TypeScript, packaged as a native iOS app via Capacitor.

## Web development

```sh
npm install
npm run dev      # start dev server
npm run build     # type-check and build for production
npm run preview   # preview the production build locally
```

## iOS (Capacitor)

```sh
npm run build         # build the web app into dist/
npx cap sync ios       # copy the web build into the native iOS project
npx cap open ios       # open the project in Xcode
```

From Xcode, select your iPhone as the run destination and press Run. Building to a physical device with a free Apple Developer account requires enabling Developer Mode on the device (Settings → Privacy & Security) and trusting the developer certificate (Settings → General → VPN & Device Management) after the first install. Free provisioning profiles expire after 7 days, so the app will need to be reinstalled from Xcode periodically.
