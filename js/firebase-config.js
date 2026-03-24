const firebaseEnv = globalThis.__APPLEO_FIREBASE_CONFIG__ || {};

function required(name, value) {
  if (!value) {
    throw new Error(`Missing required Firebase config: ${name}`);
  }

  return value;
}

export const FIREBASE_CONFIG = Object.freeze({
  apiKey: required('apiKey', firebaseEnv.apiKey),
  authDomain: required('authDomain', firebaseEnv.authDomain),
  projectId: required('projectId', firebaseEnv.projectId),
  storageBucket: required('storageBucket', firebaseEnv.storageBucket),
  messagingSenderId: required('messagingSenderId', firebaseEnv.messagingSenderId),
  appId: required('appId', firebaseEnv.appId),
  measurementId: required('measurementId', firebaseEnv.measurementId),
});
