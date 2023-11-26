# Meckano Reporter

##
* The script will fill in the required dates based on the required hours for the current month, and will skip holidays etc. 
* If the report already started a new month it will go back one month.
* If vacations have been filled it will skip them.

## Setup

### Dependencies

1. Node.js (latest LTS version)
2. Copy `.env.example` to `.env` and define the required environment variables.

### Installation

```bash
npm install
```

### Fill Report

```bash
npm run report
```
