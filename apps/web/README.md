# Scheduling Web App

Frontend application for the scheduling system.

## Development

```bash
# Install dependencies
bun install

# Start development server
bun dev

# Run TypeScript type checking
bun run typecheck

# Build for production
bun run build

# Preview production build
bun run preview
```

## Configuration

The app is configured via environment variables:

- `VITE_API_URL` - API endpoint URL (default: http://localhost:3000/api)

## Project Structure

```
src/
├── components/     # React components
│   └── ui/         # Shared UI components
├── pages/          # Page components
├── services/       # API services
├── store/          # Zustand state management
└── utils/          # Utility functions
```

## Styling

This project uses Tailwind CSS for styling. The configuration is in `tailwind.config.js`.
