# Use an official Node.js runtime as the base image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (or npm-shrinkwrap.json)
COPY package*.json ./

# Install dependencies (including dev dependencies for nodemon if needed for development)
# For production, you might want to use `npm ci --only=production` instead
RUN npm install

# Copy the rest of the application code
COPY . .

# Expojse the port the app runs on (change 3000 if your app uses a different port)
EXPOSE 8484 

# Define the command to run the application
# Since you have "type": "module" in package.json, we use node to run with ES modules
CMD ["node", "index.js"]

