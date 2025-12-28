# Pottery Pricing Application

A Next.js frontend and NestJS backend application for calculating pottery prices with custom rules.

## Getting Started

1.  **Install Dependencies**:
    ```bash
    npm install
    cd backend && npm install
    cd ../frontend && npm install
    ```

2.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    This starts both frontend (`localhost:3000`) and backend (`localhost:3001`).

## Data Scraper

This project includes a web scraper to fetch product pricing from Chesapeake Ceramics.

### How to Run the Scraper

1.  **Run the Scraper Script**:
    ```bash
    npx ts-node backend/scripts/scrape_to_db.ts
    ```
    - This will open a Chrome browser window.
    - It navigates to `https://chesapeakeceramics.com/collections/bisque`.
    - It automatically scrolls to the bottom to load all products.
    - It extracts SKU and Price data and **saves directly to the database**.
