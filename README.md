# 🎓 Exam SeatGen - Exam Hall Seating Generator

A fast, smart exam hall seating arrangement generator with roll number range exclusion, individual elective lists, class & subject tagging, and Excel spreadsheet export.

## ✨ Features
- **Hall Dimension Customizer**: Define desk rows & columns (2 seats per desk with Left/Right split).
- **Continuous Range with Exclusions**: Enter a start & end roll number range and exclude specific absent/detained/transferred roll numbers.
- **Individual Roll Numbers**: Paste custom lists of roll numbers (comma, space, or newline separated).
- **Class & Subject Tagging**: Tag each entry with Class/Section (e.g. `ECE-A`) and Subject (e.g. `VLSI Design`).
- **Real-Time Capacity Tracker**: Live count of total seats, enrolled students, and empty desks.
- **Excel Spreadsheet Export**: 1-click formatted `.xlsx` export with complete class and subject breakdown.
- **100% Free Standalone Hosting**: Works completely client-side (zero server costs on GitHub Pages) and also includes a FastAPI backend if desired.

---

## 🚀 Free Hosting Guide

### Option 1: GitHub Pages (Recommended - 100% Free, 0 Server Cost)
Because the seating generator runs fully client-side in the browser:
1. Push this repository to GitHub.
2. In your GitHub repository, go to **Settings** > **Pages**.
3. Under **Build and deployment** > **Source**, select **GitHub Actions**.
4. The included workflow (`.github/workflows/deploy.yml`) will automatically build and publish your site at `https://<your-username>.github.io/<repo-name>/` whenever you push to `main`!

---

### Option 2: Hugging Face Spaces (Free Cloud Python / Full Stack Hosting)
If you want to host both the React frontend and FastAPI backend in the cloud for free:
1. Create a free account on [huggingface.co](https://huggingface.co) and create a **New Space**.
2. Select **Docker** or **Static / FastAPI** SDK.
3. Push the code to the space repository.

---

### Option 3: GitHub Codespaces (Free Cloud Development Environment)
1. In your GitHub repository, click the green **Code** button and select the **Codespaces** tab.
2. Click **Create codespace on main**.
3. In the terminal:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
4. Click the pop-up or open the **Ports** tab to view your forwarded live URL.

---

## 💻 Running Locally

### Frontend:
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Backend (Optional):
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install fastapi uvicorn
uvicorn main:app --reload --port 8000
```
