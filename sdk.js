class AppDB {
  constructor(workerUrl) {
    this.workerUrl = workerUrl;
  }

  // Helper function to log request details.
  logRequest(method, url, data) {
    console.log(`Sending ${method} request to ${url} with data:`, data);
  }

  // Send requests to the service worker
  sendRequest(method, key, data = null) {
    let url = this.workerUrl;
    if (key) url += `?key=${encodeURIComponent(key)}`;
  
    console.log(`Sending ${method} request to ${url} with data:`, data);
  
    const fetchOptions = {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(method !== 'GET' && { body: JSON.stringify({ key, data }) }),
    };
  
    return fetch(url, fetchOptions)
      .then((response) => {
        console.log('Received response:', response);
        if (!response.ok) {
          return response.text().then((text) => {
            console.error(`Request failed: ${text}`);
            throw new Error(`Request failed: ${text}`);
          });
        }
        return response.json();
      })
      .then((data) => {
        console.log('Response JSON:', data);
        return data;
      })
      .catch((error) => {
        console.error('Error in sendRequest:', error);
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
window.getApp = function () {
  return new AppDB('/db-worker');
};