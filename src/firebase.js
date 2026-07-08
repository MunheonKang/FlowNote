import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCXXeJV0zfG-OIYdTWBzN_e87xW8Q0IpRM",
  authDomain: "flownote-3f0aa.firebaseapp.com",
  projectId: "flownote-3f0aa",
  storageBucket: "flownote-3f0aa.firebasestorage.app",
  messagingSenderId: "306465906438",
  appId: "1:306465906438:web:f9deab79fbc7e724670887"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
