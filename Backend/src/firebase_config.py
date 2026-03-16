# import firebase_admin
# from firebase_admin import credentials, firestore
# import pyrebase
# import os
# from dotenv import load_dotenv  # <-- load .env

# # Load environment variables from .env
# load_dotenv()

# # ----------------------------------
# # Admin SDK (Firestore)
# # ----------------------------------
# if not firebase_admin._apps:
#     cred = credentials.Certificate("/Users/vishaldhariwal/Code/Projects/AI Exam Grader/firebase_key.json")
#     firebase_admin.initialize_app(cred)

# db = firestore.client()

# # ----------------------------------
# # Client SDK (Pyrebase Authentication + Realtime DB)
# # ----------------------------------
# firebase_config = {
#     "apiKey": os.getenv("FIREBASE_API_KEY"),
#     "authDomain": os.getenv("FIREBASE_AUTH_DOMAIN"),
#     "projectId": os.getenv("FIREBASE_PROJECT_ID"),
#     "storageBucket": os.getenv("FIREBASE_STORAGE_BUCKET"),
#     "messagingSenderId": os.getenv("FIREBASE_MESSAGING_SENDER_ID"),
#     "appId": os.getenv("FIREBASE_APP_ID"),
#     "databaseURL": os.getenv("FIREBASE_DATABASE_URL"),  # <-- Add this
# }

# firebase = pyrebase.initialize_app(firebase_config)
# auth = firebase.auth()
# db_realtime = firebase.database()  # optional, for Realtime DB access


import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv
import os

# Load .env variables
load_dotenv()

# Initialize Firebase Admin
if not firebase_admin._apps:
    cred = credentials.Certificate(
        "/Users/vishaldhariwal/Code/Projects/AI Exam Grader/firebase_key.json"
    )
    firebase_admin.initialize_app(cred)

# Firestore database
db = firestore.client()