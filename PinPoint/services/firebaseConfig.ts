import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyC7xQfqzJJd_o_yS8eZ_3WPAtaZD0XHSVw",
  authDomain: "pinpoint-9a735.firebaseapp.com",
  projectId: "pinpoint-9a735",
  storageBucket: "pinpoint-9a735.firebasestorage.app",
  messagingSenderId: "106647663505",
  appId: "1:106647663505:web:42806c442fada8a3ae6030",
  measurementId: "G-XRXZZDE9W2",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
