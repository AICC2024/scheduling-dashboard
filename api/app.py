from flask_cors import CORS
from dotenv import load_dotenv
load_dotenv()
from flask import Flask, jsonify, request
import boto3
import pandas as pd
import io
import os
# --- Auth-related imports ---
from werkzeug.security import generate_password_hash, check_password_hash
import uuid
import psycopg2
from psycopg2.extras import RealDictCursor
import secrets
from datetime import datetime, timedelta
from botocore.exceptions import ClientError
USERS = {}

RESET_TOKENS = {}  # email -> { token, expires_at }

app = Flask(__name__)
CORS(app)

import smtplib
from email.mime.text import MIMEText

@app.route('/request-reset', methods=['POST'])
def request_reset():
    data = request.json
    email = data.get('email')
    if not email:
        return jsonify({"error": "Email is required"}), 400

    token = secrets.token_urlsafe(16)
    expires_at = datetime.utcnow() + timedelta(minutes=15)
    RESET_TOKENS[email] = {"token": token, "expires_at": expires_at}

    # Compose email
    reset_link = f"https://yourdomain.com/reset-password?token={token}&email={email}"
    subject = "Your Password Reset Link"
    body = f"To reset your password, click the link below:\n\n{reset_link}\n\nThis link will expire in 15 minutes."
    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = os.getenv("SMTP_EMAIL")
    msg["To"] = email

    try:
        with smtplib.SMTP(os.getenv("SMTP_SERVER"), int(os.getenv("SMTP_PORT"))) as server:
            server.starttls()
            server.login(os.getenv("SMTP_EMAIL"), os.getenv("SMTP_PASSWORD"))
            server.send_message(msg)
        return jsonify({"message": "Password reset email sent."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.json
    email = data.get('email')
    token = data.get('token')
    new_password = data.get('new_password')

    if not all([email, token, new_password]):
        return jsonify({"error": "Email, token, and new password are required"}), 400

    record = RESET_TOKENS.get(email)
    if not record or record['token'] != token or record['expires_at'] < datetime.utcnow():
        return jsonify({"error": "Invalid or expired token"}), 400

    password_hash = generate_password_hash(new_password)
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("UPDATE users SET password_hash = %s WHERE email = %s", (password_hash, email))
        conn.commit()
        cur.close()
        conn.close()
        del RESET_TOKENS[email]
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify({"message": "Password has been reset successfully."})

@app.route('/live-details')
def live_details():
    from datetime import datetime
    dynamodb = boto3.resource('dynamodb', region_name=os.getenv("REGION", "us-east-1"))
    patient_table_name = os.getenv("PATIENT_TABLE_NAME")
    appointment_table_name = os.getenv("APPOINTMENT_TABLE_NAME")
    input_start = request.args.get("start")
    input_end = request.args.get("end")

    try:
        start_date = datetime.strptime(input_start, "%Y-%m-%d %H:%M:%S").strftime("%m/%d/%Y %H:%M:%S")
        end_date = datetime.strptime(input_end, "%Y-%m-%d %H:%M:%S").strftime("%m/%d/%Y %H:%M:%S")
    except Exception as e:
        return jsonify({"error": f"Invalid date format: {e}"}), 400

    if not start_date or not end_date:
        return jsonify({"error": "start and end dates are required"}), 400

    patient_table = dynamodb.Table(patient_table_name)
    appointment_table = dynamodb.Table(appointment_table_name)

    def scan_table(table, start, end):
        scan_kwargs = {
            'FilterExpression': "#created BETWEEN :start AND :end",
            'ExpressionAttributeNames': {'#created': 'created_at'},
            'ExpressionAttributeValues': {
                ':start': start,
                ':end': end
            }
        }
        items = []
        response = table.scan(**scan_kwargs)
        items.extend(response.get('Items', []))
        while 'LastEvaluatedKey' in response:
            scan_kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']
            response = table.scan(**scan_kwargs)
            items.extend(response.get('Items', []))
        return items

    patients = scan_table(patient_table, start_date, end_date)
    appointments = scan_table(appointment_table, start_date, end_date)

    print(f"Start Date: {start_date}, End Date: {end_date}")
    print(f"Retrieved {len(appointments)} appointments")
    print(f"Retrieved {len(patients)} patients")

    if appointments:
        print("Sample appointment created_at:", appointments[0].get("created_at"))
    if patients:
        print("Sample patient created_at:", patients[0].get("created_at"))

    df_patients = pd.DataFrame(patients)
    df_appointments = pd.DataFrame(appointments)
    if df_patients.empty or df_appointments.empty:
        return jsonify([])

    df_patients['old_appointment_id'] = df_patients['old_appointment_id'].astype(str)
    df_appointments['id'] = df_appointments['id'].astype(str)

    merged_df = pd.merge(df_appointments, df_patients, left_on='id', right_on='old_appointment_id', how='left')
    merged_df = merged_df.fillna('')

    merged_df['Status'] = merged_df['reach_out_count'].map({
        -1: "Booked",
        -2: "Max Reached Out",
        -4: "No Selection Made",
        -3: "No Available Slots",
        -5: "Failed",
         1: "Reached Once",
         2: "Reached Twice"
    }).fillna("Other")

    merged_df['created_at'] = pd.to_datetime(merged_df['created_at_x'], errors='coerce')
    merged_df['Date'] = merged_df['created_at'].dt.strftime('%Y-%m-%d')
    merged_df['Time'] = merged_df['created_at'].dt.strftime('%H:%M:%S')
    merged_df['Provider Name'] = merged_df['doctor_name']
    merged_df['Provider Name'] = merged_df['Provider Name'].fillna('').astype(str).str.strip().replace('', 'Unknown')

    merged_df['Patient ID'] = merged_df['patient_id_x']
    department_map = {
        "6": "OHCC Adult",
        "22": "OHCC Denham",
        "27": "OHCC Baranco",
        "28": "OHCC Colonial",
        "31": "OHCC Airline North",
        "33": "OHCC Baranco Televisit",
        "34": "OHCC Eunice",
        "35": "OHCC Capital Middle",
        "37": "OHCC Airline North Televisit",
        "38": "OHCC Sharon Hills",
        "39": "OHCC Claiborne",
        "40": "OHCC Jefferson Terrace",
        "41": "OHCC Progress Elementary",
        "42": "OHCC Jefferson Terrace Televisit",
        "43": "OHCC Claiborne Televisit",
        "44": "OHCC Eunice Televisit",
        "45": "OHCC Capital Middle Televisit",
        "46": "OHCC Sharon Hills Televisit",
        "47": "OHCC Progress Elementary Televisit"
    }
    merged_df['Department'] = merged_df['department'].astype(str).map(department_map).fillna('Unknown')

    # Deduplicate based on old_appointment_id, keeping only the most recent entry
    merged_df = merged_df.sort_values(by='created_at', ascending=False)
    merged_df = merged_df.drop_duplicates(subset=['old_appointment_id'], keep='first')
    merged_df["Duplicate"] = ""

    # Ensure email and tenant_id columns exist and are filled
   
    columns = ['Patient ID', 'Date', 'Time', 'Department', 'Provider Name', 'Status', 'Duplicate', 'pt_language', 'reach_out_medium']
    return jsonify(merged_df[columns].to_dict(orient='records'))

@app.route('/booked-by-provider')
def booked_by_provider():
    from datetime import datetime
    dynamodb = boto3.resource('dynamodb', region_name=os.getenv("REGION", "us-east-1"))
    patient_table_name = os.getenv("PATIENT_TABLE_NAME")
    appointment_table_name = os.getenv("APPOINTMENT_TABLE_NAME")
    input_start = request.args.get("start")
    input_end = request.args.get("end")

    try:
        start_date = datetime.strptime(input_start, "%Y-%m-%d").strftime("%m/%d/%Y 00:00:00")
        end_date = datetime.strptime(input_end, "%Y-%m-%d").strftime("%m/%d/%Y 23:59:59")
    except Exception as e:
        return jsonify({"error": f"Invalid date format: {e}"}), 400

    def scan_table(table, start, end):
        scan_kwargs = {
            'FilterExpression': "#created BETWEEN :start AND :end",
            'ExpressionAttributeNames': {'#created': 'created_at'},
            'ExpressionAttributeValues': {
                ':start': start,
                ':end': end
            }
        }
        items = []
        response = table.scan(**scan_kwargs)
        items.extend(response.get('Items', []))
        while 'LastEvaluatedKey' in response:
            scan_kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']
            response = table.scan(**scan_kwargs)
            items.extend(response.get('Items', []))
        return items

    patient_table = dynamodb.Table(patient_table_name)
    appointment_table = dynamodb.Table(appointment_table_name)

    patients = scan_table(patient_table, start_date, end_date)
    appointments = scan_table(appointment_table, start_date, end_date)

    df_patients = pd.DataFrame(patients)
    df_appointments = pd.DataFrame(appointments)
    if df_patients.empty or df_appointments.empty:
        return jsonify([])

    df_patients['old_appointment_id'] = df_patients['old_appointment_id'].astype(str)
    df_appointments['id'] = df_appointments['id'].astype(str)

    merged_df = pd.merge(df_appointments, df_patients, left_on='id', right_on='old_appointment_id', how='left')
    merged_df = merged_df.fillna('')
    merged_df['Status'] = merged_df['reach_out_count'].map({
        -1: "Booked",
        -2: "Max Reached Out",
        -4: "No Selection Made",
        -3: "No Available Slots",
        -5: "Failed",
         1: "Reached Once",
         2: "Reached Twice"
    }).fillna("Other")
    merged_df['Provider Name'] = merged_df['doctor_name'].fillna('').astype(str).str.strip().replace('', 'Unknown')

    booked = merged_df[merged_df['Status'] == 'Booked']
    # Deduplicate using fields that are always present in merged_df
    booked = booked.drop_duplicates(subset=["doctor_name", "reach_out_count", "created_at_x"])
    if booked.empty:
        return jsonify([])

    counts = booked.groupby('Provider Name').size().reset_index(name='Booked')
    return jsonify(counts.to_dict(orient='records'))


def get_db_connection():
    return psycopg2.connect(os.getenv("DATABASE_URL"), cursor_factory=RealDictCursor)

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    tenant_id = email.split('@')[1].split('.')[0]
    password_hash = generate_password_hash(password)

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("INSERT INTO users (email, password_hash, tenant_id) VALUES (%s, %s, %s)",
                    (email, password_hash, tenant_id))
        conn.commit()
        cur.close()
        conn.close()
    except psycopg2.errors.UniqueViolation:
        return jsonify({"error": "User already exists"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify({"message": "User registered successfully", "tenant_id": tenant_id})

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cur.fetchone()
        cur.close()
        conn.close()

        if not user or not check_password_hash(user['password_hash'], password):
            return jsonify({"error": "Invalid credentials"}), 401

        return jsonify({"message": "Login successful", "tenant_id": user['tenant_id']})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)