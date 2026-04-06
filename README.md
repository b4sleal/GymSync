Markdown
# GymSync - Implementation & Setup Guide

## Overview
* GymSync is a web application designed to help users manage their fitness routines and stay on top of their goals.
* It provides a user-friendly interface for creating, tracking, and analyzing workout plans, as well as a chatbot feature for personalized fitness advice.
* To view the live application, visit [GymSync](https://gymsync.ca/). 
* To run locally follow the instructions below.

## 1. Local Setup & Execution

Follow these steps to get the development environment running on your local machine.

### Prerequisites
* **Docker** - [Download & Install](https://docs.docker.com/get-docker/)
* **Docker Compose** - [Download & Install](https://docs.docker.com/compose/install/)
* **Docker Desktop (Optional, for viewing)** - [Download & Install](https://www.docker.com/products/docker-desktop)

### Step-by-Step Instructions To Run Locally

1.  **Launch (Docker):**
    * Run the following command in the project root directory terminal:
        ```bash
        docker-compose up -d
        ```
    * *Note:* The `docker-compose.yml` file automatically creates the container and maps the persistent data volume based on the settings defined in the file.
<br></br>
2.  **Try it!:**
    * The server will start on `http://localhost:8000`. You can access the landing page directly through your browser.
<br></br>
3.  **Configure Environment Variables (Optional):**
    * Navigate to the root directory and create a  `.env` file.
    * Add `DB_URL` to connect to a differnet PostgreSQL database, and PORT to specify the port number the application runs on.
    * Example:
      ```
      DB_URL=postgres://user:pass@localhost:5433/gymsync
      PORT=8000
      ```
    * Add `GEMINI_API_KEY` and `GEMINI_MODEL` to enable the GymSync Chatbot.
      * Example:
        ```
        GEMINI_API_KEY=your_gemini_api_key_here
        GEMINI_MODEL=gemini-pro-2.0
        ```
---

## 2. Team Member Contributions

| Member                  | Primary Focus                 | Key Contributions                                                                                 |
|:------------------------|:------------------------------|:--------------------------------------------------------------------------------------------------|
| **Basleal Abshiro**     | Frontend & Backend & Database | Integration of planner/chat pages, UI/UX Designs, Docker setup, and SQL table architecture.       |
| **Kareem Chaudhry**     | Frontend & Backend            | Integration of register/login pages, Frontend-to-Backend fetch logic, and Controller development. |
| **Rusanth Pirabakaran** | Backend & Database            | Integration of workout/dashboard pages, Unit Testing, and Database referential integrity.         |

---