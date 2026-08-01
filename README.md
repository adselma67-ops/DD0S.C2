# Traffic Resilience Dashboard

## Overview
The Traffic Resilience Dashboard is a network traffic monitoring and resilience testing tool designed to visualize and manage load simulations. This project provides a control dashboard that allows users to initiate stress tests, monitor agent statuses, and view live metrics.

## Project Structure
```
traffic-resilience-dashboard
├── README.md
├── package.json
├── tsconfig.json
├── client
│   ├── index.html
│   └── src
│       ├── App.tsx
│       ├── main.tsx
│       └── components
│           └── Dashboard.tsx
└── server
    └── src
        ├── app.ts
        ├── controllers
        │   └── simulations.ts
        ├── routes
        │   └── index.ts
        ├── services
        │   ├── monitoring.ts
        │   └── resilience.ts
        └── types
            └── index.ts
```

## Setup Instructions

### Prerequisites
- Node.js (version 14 or higher)
- npm (Node Package Manager)

### Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   cd traffic-resilience-dashboard
   ```

2. Install dependencies:
   ```
   npm install
   ```

### Running the Application
1. Start the server:
   ```
   npm run start:server
   ```

2. Start the client:
   ```
   npm run start:client
   ```

3. Open your browser and navigate to `http://localhost:3000` to access the dashboard.

## Usage Guidelines
- Use the control panel to initiate load simulations.
- Monitor agent statuses and view live metrics in real-time.
- Check the activity log for detailed information on the stress tests.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.