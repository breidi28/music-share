# Music Share

A social music sharing platform built with React Native and Flask that allows users to discover, share, and discuss music with friends. Connect your streaming services, build your physical media collection, and engage with a community of music enthusiasts.

## Features

### Social Features
- **Music Feed** - Share tracks from various streaming services with your followers
- **Comments & Likes** - Engage with posts through comments and likes
- **User Profiles** - Follow other users and view their music activity
- **Search & Discovery** - Find users and explore new music

### Music Service Integrations
- Spotify
- YouTube Music
- Apple Music
- Tidal
- Qobuz
- Deezer

### Collection Management
- **Physical Media Collection** - Catalog your vinyl, CDs, cassettes, and digital albums
- **Barcode Scanning** - Quickly add items by scanning barcodes using MusicBrainz database
- **Detailed Tracking** - Record condition, purchase date, release year, and personal notes
- **Public Collections** - Share your collection with other users

### Additional Features
- iTunes Search API integration for music discovery
- Real-time notifications
- User authentication with JWT tokens
- Profile customization with avatars and bios

## Tech Stack

### Frontend
- **React Native** (0.81.5) - Cross-platform mobile development
- **Expo** (54.0.33) - Development and build tooling
- **TypeScript** - Type-safe development
- **Zustand** - State management
- **Axios** - HTTP client
- **React Navigation** - Navigation framework
- **NativeWind/Tailwind** - Styling

### Backend
- **Flask** (2.0+) - Python web framework
- **SQLAlchemy** - ORM and database management
- **Flask-JWT-Extended** - JWT authentication
- **Flask-CORS** - Cross-origin resource sharing
- **SQLite** - Database
- **bcrypt** - Password hashing

### External APIs
- iTunes Search API
- MusicBrainz API
- Cover Art Archive
- OAuth 2.0 for music service integrations

## Installation

### Prerequisites
- Node.js (v16 or higher)
- Python (3.8 or higher)
- npm or yarn
- Expo CLI
- Git

### Clone Repository
```bash
git clone https://github.com/breidi28/music-share.git
cd music-share
```

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
```

3. Activate virtual environment:
- Windows:
  ```bash
  venv\Scripts\activate
  ```
- macOS/Linux:
  ```bash
  source venv/bin/activate
  ```

4. Install dependencies:
```bash
pip install -r requirements.txt
```

5. Create `.env` file in the backend directory:
```env
SECRET_KEY=your_secret_key_here
JWT_SECRET_KEY=your_jwt_secret_key_here
DATABASE_PATH=instance/musicshare.db
CORS_ORIGINS=exp://YOUR_IP:8081

# Optional: one-time admin bootstrap (disabled by default)
BOOTSTRAP_ADMIN_ON_STARTUP=false
BOOTSTRAP_ADMIN_IDENTIFIER=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=change_me_now

# Music Service API Credentials (optional)
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
TIDAL_CLIENT_ID=your_tidal_client_id
TIDAL_CLIENT_SECRET=your_tidal_client_secret
```

6. Initialize database:
```bash
python
>>> from app import app, db
>>> app.app_context().push()
>>> db.create_all()
>>> exit()
```

7. Start the Flask server:
```bash
python app.py
```

The server will run on `http://0.0.0.0:5000`

### Frontend Setup

1. Navigate to project root:
```bash
cd ..
```

2. Install dependencies:
```bash
npm install
```

3. Update API configuration:
- Edit `src/api/client.ts` and update `API_BASE_URL` with your computer's IP address

4. Start Expo development server:
```bash
npx expo start
```

5. For barcode scanning feature, create a development build:
```bash
# Android
npx expo run:android

# iOS
npx expo run:ios
```

Note: Barcode scanning requires a development build and won't work in Expo Go.

## Usage

### Running the Application

1. Start the backend server (ensure virtual environment is activated):
```bash
cd backend
python app.py
```

2. Start the Expo development server:
```bash
npx expo start
```

3. Scan the QR code with Expo Go app (iOS/Android) or run on an emulator

### Creating an Account

1. Launch the app
2. Tap "Register" on the login screen
3. Fill in username, email, and password
4. Tap "Create Account"

### Connecting Music Services

1. Navigate to Profile tab
2. Tap the settings icon
3. Select a music service under "Music Services"
4. Authorize the connection in the browser
5. Return to the app to see the connected service

### Sharing Music

1. Tap the share button (center of navigation bar)
2. Search for a track using the search bar
3. Select the track from results
4. Add an optional caption
5. Tap "Post" to share with followers

### Building Your Collection

1. Navigate to Collection tab
2. Tap the "+" button
3. Search manually or scan a barcode
4. Add details (media type, condition, notes, etc.)
5. Tap "Add to Collection"

## Project Structure

```
music-share/
├── backend/
│   ├── app.py                 # Flask application and API routes
│   ├── requirements.txt       # Python dependencies
│   ├── .env                   # Environment variables (create this)
│   └── instance/
│       └── musicshare.db      # SQLite database (auto-generated)
├── src/
│   ├── api/
│   │   ├── client.ts          # Axios client configuration
│   │   └── endpoints.ts       # API endpoint definitions
│   ├── components/
│   │   ├── PostCard.tsx       # Music post component
│   │   ├── CommentsModal.tsx  # Comments interface
│   │   └── ui/                # UI components (gluestack)
│   ├── navigation/
│   │   └── AppNavigator.tsx   # App navigation structure
│   ├── screens/
│   │   ├── FeedScreen.tsx     # Home feed
│   │   ├── ExploreScreen.tsx  # User discovery
│   │   ├── ShareScreen.tsx    # Post creation
│   │   ├── CollectionScreen.tsx  # Physical media collection
│   │   ├── ProfileScreen.tsx  # User profile
│   │   ├── LoginScreen.tsx    # Authentication
│   │   └── SettingsScreen.tsx # App settings
│   ├── store/
│   │   └── authStore.ts       # Authentication state management
│   ├── types/
│   │   └── index.ts           # TypeScript type definitions
│   └── theme.ts               # Color scheme and theming
├── assets/                    # Images and static files
├── App.tsx                    # Root component
├── package.json               # Node dependencies
├── tsconfig.json             # TypeScript configuration
└── app.json                  # Expo configuration
```

## API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - Authenticate user
- `GET /api/auth/me` - Get current user profile

### Post Endpoints
- `GET /api/posts/feed` - Get posts from followed users
- `POST /api/posts` - Create a new post
- `POST /api/posts/:id/like` - Like/unlike a post
- `GET /api/posts/:id/comments` - Get post comments
- `POST /api/posts/:id/comment` - Add a comment

### User Endpoints
- `GET /api/users/:id` - Get user profile
- `POST /api/users/:id/follow` - Follow/unfollow user
- `GET /api/users/:id/followers` - Get user's followers
- `GET /api/users/:id/following` - Get users being followed

### Collection Endpoints
- `GET /api/collection` - Get user's collection
- `POST /api/collection` - Add item to collection
- `PUT /api/collection/:id` - Update collection item
- `DELETE /api/collection/:id` - Remove from collection
- `GET /api/music/barcode/:barcode` - Search by barcode

### Music Service Endpoints
- OAuth authentication flows for each service
- Playlist and favorites retrieval
- Service disconnection

## Configuration

### Network Configuration
If you change networks or your IP address changes, update:
1. Backend `.env` file - `CORS_ORIGINS`
2. Frontend `src/api/client.ts` - `API_BASE_URL`

### Development Builds
For features requiring native modules (barcode scanning):
```bash
# Android
npx expo run:android

# iOS  
npx expo run:ios
```

## Known Limitations

- Tidal OAuth integration requires additional session storage implementation
- Apple Music integration requires MusicKit setup
- Some music services require API credentials to be configured
- Barcode scanning only works with development builds, not Expo Go
- Push notifications are not yet implemented

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Contact

For questions or support, please contact:
- GitHub: [@breidi28](https://github.com/breidi28)
- Repository: [music-share](https://github.com/breidi28/music-share)
