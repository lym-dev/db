function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (char) {
    const random = Math.random() * 16 | 0; // Generate a random number between 0 and 15
    const value = char === 'x' ? random : (random & 0x3 | 0x8); 
    return value.toString(16); 
  });
}

function getID() {
  let uuid = localStorage.getItem('uuid');
  if (!uuid) {
    uuid = generateUUID();
    localStorage.setItem('uuid', uuid); 
  }
  return uuid;
}

class AppDB {
  constructor(workerUrl, developerKey) {
    this.workerUrl = workerUrl;
    this.developerKey = developerKey;
  }

  // Helper function to log request details.
  logRequest(method, url, data) {
    console.log(`Sending ${method} request to ${url} with data:`, data);
  }

  // Send requests to the service worker with developer key authentication
  sendRequest(method, key, data = null) {
    let url = this.workerUrl;
    if (key) url += `?key=${encodeURIComponent(key)}`;

    const fetchOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Developer-Key': this.developerKey, // Include developer key in headers
      },
      ...(method !== 'GET' && { body: JSON.stringify({ key, data }) }),
    };

    return fetch(url, fetchOptions)
      .then((response) => {
        if (!response.ok) {
          return response.text().then((text) => {
            throw new Error(`Request failed: ${text}`);
          });
        }
        return response.json();
      })
      .then((data) => {
        if (!data.developerKeyValid) {
          // Check if developer key validation failed in the response
          throw new Error('Developer key not found');
        }
        return data;
      })
      .catch((error) => {
        console.error('Error in sendRequest:', error);
        throw error;
      });
  }

  // Set authentication method
  setAuth() {
    const key = getID();
    localStorage.setItem('userUuid', key);
    return this.sendRequest('SETAUTH', key)
      .then((response) => {
        console.log('setAuth response:', response);
        return response;
      })
      .catch((error) => {
        console.error('Error in setAuth method:', error);
        throw error;
      });
  }
  
  // Remove authentication method
  removeAuth() {
    const key = localStorage.getItem('userUuid'); // Retrieve user UUID from localStorage
    if (!key) {
      return Promise.reject(new Error('User is not authenticated.'));
    }
  
    localStorage.removeItem('userUuid'); // Remove the UUID from localStorage
  
    return this.sendRequest('REMOVEAUTH', key) // Use the correct method for removing authentication
      .then((response) => {
        console.log('removeAuth response:', response);
        return response;
      })
      .catch((error) => {
        console.error('Error in removeAuth method:', error);
        throw error;
      });
  }

  // Get authentication method
  getAuth() {
    const key = localStorage.getItem('userUuid');
    if (!key) {
      return Promise.reject(new Error('User not authenticated'));
    }

    return this.sendRequest('GETAUTH', key)
      .then((response) => {
        console.log('getAuth response:', response);
        return response;
      })
      .catch((error) => {
        console.error('Error in getAuth method:', error);
        throw error;
      });
  }

  // Set method
  async set(key, data) {
    if (!key || !data) {
      return Promise.reject(new Error('Key and data must be provided for set operation.'));
    }
    return this.sendRequest('POST', key, data);
  }
  
  // Set method
  async setDev(key, data) {
    if (!key || !data) {
      return Promise.reject(new Error('Key and data must be provided for set operation.'));
    }
    return this.sendRequest('SETDEV', key, data);
  }

  // Get method
  get(key) {
    return this.sendRequest('GET', key)
      .then((response) => (response.message === 'No data found' ? null : response))
      .catch((error) => {
        console.error('Error in get method:', error);
        throw error;
      });
  }

  // Update method
  update(key, data) {
    if (!key) {
      return Promise.reject(new Error('Key must be provided for update operation.'));
    }
    return this.sendRequest('PUT', key, data);
  }

  // Remove method
  remove(key) {
    if (!key) {
      return Promise.reject(new Error('Key must be provided for remove operation.'));
    }
    return this.sendRequest('DELETE', key);
  }
}

// Initialize the SDK for the app
window.getApp = function (developerKey) {
  return new AppDB('/db-worker', developerKey);
};
