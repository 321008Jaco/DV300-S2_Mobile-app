<h1 align="center">PinPoint</h1>

<p align="center">
  Save places. Share them with the right people.
  <br />
  <a href="#installation"><strong>Install</strong></a>
  ·
  <a href="#usage"><strong>Usage</strong></a>
  ·
  <a href="#screens--features"><strong>Features</strong></a>
  ·
  <a href="#development-notes"><strong>Dev Notes</strong></a>
</p>

<p align="center">
  <a href="https://expo.dev/"><img src="https://img.shields.io/badge/Expo-51%2B-000?logo=expo&logoColor=white" alt="Expo" /></a>
  <a href="https://firebase.google.com/"><img src="https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore%20%7C%20Storage-ffca28?logo=firebase&logoColor=black" alt="Firebase" /></a>
  <a href="https://reactnative.dev/"><img src="https://img.shields.io/badge/React%20Native-0.7x-61dafb?logo=react&logoColor=black" alt="RN" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License: MIT" /></a>
</p>

---

## Table of Contents

- [About](#about)
- [Built With](#built-with)
- [Screens & Features](#screens--features)
- [Project Structure](#project-structure)
- [Installation](#installation)
  - [1) Clone](#1-clone)
  - [2) Install dependencies](#2-install-dependencies)
  - [3) Configure Firebase](#3-configure-firebase)
  - [4) Configure Google Maps](#4-configure-google-maps)
  - [5) Run locally](#5-run-locally)
- [Usage](#usage)
- [Security & Environment](#security--environment)
- [Development Notes](#development-notes)
- [Roadmap](#roadmap)
- [Screenshots / Mockups](#screenshots--mockups)
- [License](#license)
- [Authors](#authors)
- [Acknowledgements](#acknowledgements)

[⬆️ Back to top](#pinpoint)

---

## About

**PinPoint** is a cross-platform mobile app for dropping pins and controlling visibility:

- **Public** pins (everyone)
- **Private** pins (only you)
- **Close Friends** pins (only people you marked as close friends)

Includes friend requests, close-friend syncing, user profiles, custom splash/onboarding, and a clean tabbed UI.

[⬆️ Back to top](#pinpoint)

---

## Built With

- **Expo / React Native (TypeScript)**
- **Firebase** Auth · Firestore · Storage
- **react-native-maps** (Google Maps)
- **Expo modules**: Location, Image Picker, Splash Screen
- **React Navigation** (Native Stack + Bottom Tabs)

[⬆️ Back to top](#pinpoint)

---
## Demo Video

https://drive.google.com/drive/folders/1wZ-CzvxJmXHOKfUgG3ro3sQSXoNr-8z3?usp=sharing

---

## Screens & Features

| Area | Highlights |
|------|------------|
| **Auth** | Email/password (Firebase Auth) |
| **Map** | Global / Private / Close tabs; orange avatar markers; long-press to add |
| **Pins** | Create, Edit, Delete; visibility control; open Google Maps directions |
| **Friends** | Send/accept/reject/cancel requests; unfriend |
| **Close Friends** | Toggle; close-only pins appear in the Close tab |
| **Profiles** | Display name, username, bio, avatar; public profile surface |
| **View Friend** | Profile with actions + pin counts |
| **UI** | Custom splash with logo animation, onboarding, shared `Navbar` component |

[⬆️ Back to top](#pinpoint)

---

## Project Structure

```bash
PinPoint/
├── app.json
├── eas.json
├── package.json
├── App.tsx
├── assets/
│   ├── icon.png
│   ├── PinPointSplash.png
│   └── screenshots/
├── components/
│   └── Navbar.tsx
├── screens/
│   ├── HomeScreen.tsx
│   ├── LoginScreen.tsx
│   ├── SignUpScreen.tsx
│   ├── ProfileScreen.tsx
│   └── ViewFriend.tsx
└── services/
    └── firebaseConfig.ts
```

[⬆️ Back to top](#pinpoint)

---

## Installation
1) Clone
```bash
git clone <(https://github.com/321008Jaco/DV300-S2_Mobile-app.git)>
cd PinPoint
```

2) Install dependencies
```bash
npm install
```

3) Configure Firebase
Create services/firebaseConfig.ts with your own project credentials.
Keep placeholders in the repo; do not commit real keys.

```bash

// services/firebaseConfig.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
```

4) Configure Google Maps
Edit app.json with your Google Maps API keys. Use placeholders in git:

```bash
{
  "expo": {
    "name": "PinPoint",
    "slug": "PinPoint",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/PinPointSplash.png",
      "resizeMode": "contain",
      "backgroundColor": "#FFFFFF"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.your.bundleid",
      "config": { "googleMapsApiKey": "YOUR_IOS_GOOGLE_MAPS_API_KEY" }
    },
    "android": {
      "package": "com.your.package",
      "adaptiveIcon": {
        "foregroundImage": "./assets/icon.png",
        "backgroundColor": "#ffffff"
      },
      "edgeToEdgeEnabled": true,
      "config": { "googleMaps": { "apiKey": "YOUR_ANDROID_GOOGLE_MAPS_API_KEY" } }
    },
    "web": { "favicon": "./assets/favicon.png" }
  }
}
```
Note (Android): If you restrict your key, make sure the debug SHA-1 / app signatures are added in Google Cloud Console.

5) Run locally
Start the Metro server:

```bash

npx expo start
```

[⬆️ Back to top](#pinpoint)

---

## Usage
Log in or sign up.

Long-press the map (or tap +) to add a pin.

Choose visibility: Public, Private, or Close Friends.

Tap a pin → Waypoint to open Google Maps directions.

Update your Profile (display name, username, bio, avatar).

Manage friends and mark Close Friends.

Switch Home tabs: Global / Private / Close.

[⬆️ Back to top](#pinpoint)

---

## Development Notes
Splash + Animation handled in App.tsx with expo-splash-screen and a brief fade/scale overlay.

Onboarding shows first time per session, then hidden.

Navbar is a shared component (components/Navbar.tsx) used across Home & Profile.

Markers are uniform orange with circular avatar and diamond pointer; username initial fallback.

Close Friends uses Firestore “signal” docs to sync status both ways.

[⬆️ Back to top](#pinpoint)

---

## Screenshots / Mockups

<img width="301" height="539" alt="image" src="https://github.com/user-attachments/assets/3ada6bf2-b9d2-4cdd-a4b9-866847ebc80e" />

<img width="797" height="668" alt="image" src="https://github.com/user-attachments/assets/cf97fc20-a0cd-494c-a737-efa39efcc516" />



[⬆️ Back to top](#pinpoint)

---

## License
MIT © PinPoint

[⬆️ Back to top](#pinpoint)

---

## Authors
Jaco Mostert – [GitHub](https://github.com/321008Jaco)

[⬆️ Back to top](#pinpoint)

---

## Acknowledgements
Open Window, School of Creative Technologies

Google Maps Platform

Firebase

Expo & React Native

Figma & Stack Overflow

[⬆️ Back to top](#pinpoint)
---
