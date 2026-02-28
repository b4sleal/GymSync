Markdown
# GymSync - Implementation & Setup Guide

## 1. Local Setup & Execution

Follow these steps to get the development environment running on your local machine.

### Prerequisites
* **Docker & Docker Desktop** (for PostgreSQL)
* **Node.js** (v16 or higher)
* **NPM**

### Step-by-Step Instructions

1.  **Configure Environment Variables:**
    * Navigate to the root directory and locate the `.env` file.
    * Add your `DATABASE_URL` (e.g., `postgres://user:pass@localhost:5433/gymsync`).
    * Ensure the ports match your `docker-compose.yml` settings.

2.  **Launch the Database (Docker):**
    * Run the following command in your terminal:
        ```bash
        docker-compose up -d
        ```
    * *Note:* The `docker-compose.yml` file automatically creates the container and maps the persistent data volume based on the settings defined in the file.

3.  **Install Backend Dependencies:**
    * Navigate to the backend source folder:
        ```bash
        cd src/backend
        ```
    * Install the required Node.js packages:
        ```bash
        npm install
        ```

4.  **Start the Application:**
    * Run the start script from the backend directory:
        ```bash
        npm start
        ```
    * The server will start on `http://localhost:8000`. You can access the landing page directly through your browser.



---

## 2. Team Member Contributions

| Member                  | Primary Focus               | Key Contributions |
|:------------------------|:----------------------------| :--- |
| **Basleal Abshiro**     | Frontend & Backend Database | UI/UX design for landing/login pages, Schema normalization, and SQL table architecture. |
| **Kareem Chaudhry**     | Frontend & Backend          | Integration of Auth API routes, Frontend-to-Backend fetch logic, and Controller development. |
| **Rusanth Pirabakaran** | Backend & Database          | API routing structure, Docker Compose configuration, and database referential integrity. |

---