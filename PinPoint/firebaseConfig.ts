// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC7xQfqzJJd_o_yS8eZ_3WPAtaZD0XHSVw",
  authDomain: "pinpoint-9a735.firebaseapp.com",
  projectId: "pinpoint-9a735",
  storageBucket: "pinpoint-9a735.firebasestorage.app",
  messagingSenderId: "106647663505",
  appId: "1:106647663505:web:42806c442fada8a3ae6030",
  measurementId: "G-XRXZZDE9W2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
