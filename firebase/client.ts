import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBmAqrx4zz0hitskeA4wKQ4q5Cv7ifmObk",
  authDomain: "interviewprep-1968.firebaseapp.com",
  projectId: "interviewprep-1968",
  storageBucket: "interviewprep-1968.firebasestorage.app",
  messagingSenderId: "429691941788",
  appId: "1:429691941788:web:1bee0d23cac5830f870e59",
  measurementId: "G-EMS7E386YV"
};


// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
