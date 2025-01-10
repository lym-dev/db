self.addEventListener('fetch', function (event) {
  console.log('Fetch event for:', event.request.url);

  const url = new URL(event.request.url);
  const key = url.searchParams.get('key'); // Extract the key from the query parameter
  const developerKey = event.request.headers.get('Developer-Key'); // Get the developer key from headers

  if (url.pathname.endsWith('/db-worker')) {
    event.respondWith(
      (async () => {
        if (event.request.method === 'SETDEV') {
          // Directly handle SETDEVELOPER without validating developer key
          const requestData = await event.request.json();
          return setDeveloper(requestData.key, requestData.data)
            .then(() =>
              new Response(
                JSON.stringify({ status: 'success', message: 'Developer key and data stored successfully.' }),
                { status: 200 }
              )
            )
            .catch((error) =>
              new Response(
                JSON.stringify({ status: 'error', message: error.message }),
                { status: 500 }
              )
            );
        }

        // For all other methods, validate the developer key first
        try {
          await validateDeveloperKey(developerKey);
        } catch (error) {
          return new Response(
            JSON.stringify({ status: 'error', message: error.message }),
            { status: 403 }
          );
        }

        // Handle other request methods
        if (event.request.method === 'SETAUTH') {
          const requestData = await event.request.json();
          return setAuth(requestData.key).then(() =>
            new Response(
              JSON.stringify({ status: 'success', message: 'User authenticated successfully.' }),
              { status: 200 }
            )
          );
        } else if (event.request.method === 'REMOVEAUTH') {
          return removeAuth(key).then(() =>
            new Response(
              JSON.stringify({ status: 'success', message: 'User authentication removed successfully.' }),
              { status: 200 }
            )
          );
        } else if (event.request.method === 'GETAUTH') {
          return getAuth(key);
        } else if (event.request.method === 'GET') {
          return getDataFromDB(key);
        } else if (event.request.method === 'POST') {
          const requestData = await event.request.json();
          return storeDataInDB(requestData.key, requestData.data);
        } else if (event.request.method === 'PUT') {
          const requestData = await event.request.json();
          return updateDataInDB(requestData.key, requestData.data);
        } else if (event.request.method === 'DELETE') {
          const requestData = await event.request.json();
          if (!requestData.key) {
            return new Response(JSON.stringify({ error: 'Key is required for deletion.' }), { status: 400 });
          }
          return removeDataFromDB(requestData.key);
        }

        return new Response(JSON.stringify({ error: 'Unsupported method' }), { status: 405 });
      })()
    );
  }
});

// Function to validate developer key
function validateDeveloperKey(developerKey) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      if (!developerKey) {
        return reject(new Error('No Developer Key provided.'));
      }

      const transaction = db.transaction('chatStore', 'readonly');
      const store = transaction.objectStore('chatStore');
      const request = store.get('developers/' + developerKey); // Retrieve developer key from DB

      request.onsuccess = (event) => {
        const result = event.target.result;
        if (result && result.valid) {
          resolve(); // Developer key is valid
        } else {
          reject(new Error('Invalid Developer Key.'));
        }
      };

      request.onerror = (event) =>
        reject(new Error('Error checking Developer Key: ' + event.target.errorCode));
    });
  });
}

// Function to open the IndexedDB database
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ChatDatabase', 1);
    request.onupgradeneeded = function (event) {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('chatStore')) {
        db.createObjectStore('chatStore', { keyPath: 'id' });
      }
    };
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(new Error('Error opening the database: ' + event.target.errorCode));
  });
}

// Function to authenticate user
function setAuth(key) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('chatStore', 'readwrite');
      const store = transaction.objectStore('chatStore');
      const request = store.put({ id: key, authenticated: true });

      request.onsuccess = () => {
        resolve(new Response(JSON.stringify({ status: 'success', message: 'User authenticated!' }), { status: 200 }));
      };
      request.onerror = (event) =>
        reject(new Error('Error in authentication: ' + event.target.errorCode));
    });
  });
}

// Function to remove authentication
function removeAuth(key) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('chatStore', 'readwrite');
      const store = transaction.objectStore('chatStore');

      const request = store.delete(key); // Correctly assign the delete request

      request.onsuccess = () => {
        resolve(
          new Response(
            JSON.stringify({ status: 'success', message: 'User authentication removed!' }),
            { status: 200 }
          )
        );
      };

      request.onerror = (event) =>
        reject(new Error('Error removing authentication: ' + event.target.errorCode));
    });
  });
}

// Function to get user authentication
function getAuth(key) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('chatStore', 'readonly');
      const store = transaction.objectStore('chatStore');
      const request = store.get(key);

      request.onsuccess = (event) => {
        const result = event.target.result;
        if (result && result.authenticated) {
          resolve(new Response(JSON.stringify({ status: 'success', message: 'User is authenticated!' }), { status: 200 }));
        } else {
          resolve(new Response(JSON.stringify({ error: 'User not authenticated' }), { status: 403 }));
        }
      };
      request.onerror = (event) => reject(new Error('Error retrieving authentication status: ' + event.target.errorCode));
    });
  });
}

// Function to store data in the database
function storeDataInDB(key, data) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('chatStore', 'readwrite');
      const store = transaction.objectStore('chatStore');
      const request = store.put({ id: key, data });

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(new Error('Error storing data: ' + event.target.errorCode));
    });
  });
}

// Function to store developer in the database
function setDeveloper(key, data) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('chatStore', 'readwrite');
      const store = transaction.objectStore('chatStore');
      const request = store.put({ id: key, data });

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(new Error('Error setting developer: ' + event.target.errorCode));
    });
  });
}

// Function to retrieve data from the database
function getDataFromDB(key = '') {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('chatStore', 'readonly');
      const store = transaction.objectStore('chatStore');

      if (key) {
        const request = store.get(key);
        request.onsuccess = (event) => {
          const result = event.target.result;
          if (result) {
            resolve(new Response(JSON.stringify(result.data), { headers: { 'Content-Type': 'application/json' } }));
          } else {
            resolve(new Response(JSON.stringify({ message: 'No data found' }), { status: 404 }));
          }
        };
        request.onerror = (event) => reject(new Error('Error retrieving data: ' + event.target.errorCode));
      } else {
        const allData = {};
        const cursorRequest = store.openCursor();

        cursorRequest.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            allData[cursor.key] = cursor.value.data;
            cursor.continue();
          } else {
            resolve(new Response(JSON.stringify(allData), { headers: { 'Content-Type': 'application/json' } }));
          }
        };
        cursorRequest.onerror = (event) => reject(new Error('Error retrieving all data: ' + event.target.errorCode));
      }
    });
  });
}

// Function to update data in the database
function updateDataInDB(key, newData) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('chatStore', 'readwrite');
      const store = transaction.objectStore('chatStore');
      
      if(!key){
        reject(new Error('Error updating data. Key not found '));
        return;
      }
      
      const request = store.get(key);
      request.onsuccess = (event) => {
        const existingData = event.target.result || { id: key, data: {} };
        const updatedData = { ...existingData, data: { ...existingData.data, ...newData } };
        const updateRequest = store.put(updatedData);

        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = (event) =>
          reject(new Error('Error updating data: ' + event.target.errorCode));
      };
      request.onerror = (event) => reject(new Error('Error fetching old data: ' + event.target.errorCode));
    });
  });
}

// Function to remove data from the database
function removeDataFromDB(key) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('chatStore', 'readwrite');
      const store = transaction.objectStore('chatStore');
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(new Error('Error removing data: ' + event.target.errorCode));
    });
  });
}
