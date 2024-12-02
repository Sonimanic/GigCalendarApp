# GigCalendar App

A full-stack application for managing band gigs, members, and commitments.

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- MongoDB Atlas account
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Sonimanic/GigCalendarApp.git
cd GigCalendarApp
```

2. Install dependencies for both API and client:
```bash
# Install API dependencies
cd GigCalendar-API
npm install

# Install client dependencies
cd ../GigCalendar-Client
npm install
```

3. Set up MongoDB connection:
   - Create a `.env` file in the `GigCalendar-API` directory
   - Add your MongoDB connection string:
     ```
     MONGODB_URI=your_mongodb_connection_string
     ```

### Running the Application

1. Start the API server:
```bash
cd GigCalendar-API
npm start
```

2. Start the client:
```bash
cd GigCalendar-Client
npm run dev
```

## API Endpoints

The API server runs on `http://localhost:3000` by default.

### Authentication
- **Login**: `POST /api/login`
  ```json
  {
    "email": "user@example.com",
    "password": "password"
  }
  ```

### Members
- **Get all members**: `GET /api/members`
- **Add new member**: `POST /api/members`
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "1234567890",
    "password": "password",
    "role": "musician"
  }
  ```

### Gigs
- **Get all gigs**: `GET /api/gigs`
- **Add new gig**: `POST /api/gigs`
  ```json
  {
    "title": "Summer Concert",
    "date": "2024-07-01",
    "venue": "City Park",
    "address": "123 Park Ave",
    "description": "Outdoor summer concert",
    "payment": "500",
    "requirements": "Bring own equipment",
    "status": "confirmed"
  }
  ```
- **Update gig**: `PUT /api/gigs/:id`
- **Delete gig**: `DELETE /api/gigs/:id`

### Commitments
- **Get all commitments**: `GET /api/commitments`
- **Add new commitment**: `POST /api/commitments`
  ```json
  {
    "memberId": "member_id",
    "gigId": "gig_id",
    "status": "confirmed"
  }
  ```

## Testing API Endpoints

You can test the API endpoints using tools like Postman or curl:

1. Test the root endpoint:
```bash
curl http://localhost:3000/
```

2. Login:
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

3. Get all members:
```bash
curl http://localhost:3000/api/members
```

4. Get all gigs:
```bash
curl http://localhost:3000/api/gigs
```

## Pushing Changes to GitHub

1. Stage your changes:
```bash
git add .
```

2. Commit your changes:
```bash
git commit -m "Your commit message"
```

3. Push to GitHub:
```bash
git push origin main
```

If you're pushing for the first time:
```bash
git push --set-upstream origin main
```

## Real-time Updates

The application uses Socket.IO for real-time updates. When data changes occur (new gigs, commitments, etc.), all connected clients will automatically receive the updates.

## Error Handling

The API includes comprehensive error handling:
- 400: Bad Request - Invalid data submitted
- 401: Unauthorized - Invalid credentials
- 404: Not Found - Resource not found
- 500: Internal Server Error - Server-side issues

## Security

- CORS is configured to allow specific origins
- Passwords should be hashed (TODO)
- API endpoints are protected (TODO: Add JWT authentication)

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/new-feature`
3. Commit your changes: `git commit -m 'Add new feature'`
4. Push to the branch: `git push origin feature/new-feature`
5. Submit a pull request

## License

This project is licensed under the MIT License.
