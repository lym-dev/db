self.addEventListener('fetch', function (event) {
  console.log('Fetch event for:', event.request.url);

  const url = new URL(event.request.url);
  const key = url.searchParams.get('key'); // Extract the key from the query parameter
  const developerKey = event.request.headers.get('Developer-Key'); // Get the developer key from headers

  if (url.pathname.endsWith('/db-worker')) {
    event.respondWith(
      (async () => {
        // Handle SETDEV without validating the developer key
        if (event.request.method === 'SETDEV') {
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
        } else {
          // Validate developer key for other methods
          let developerStoreName;
          try {
            developerStoreName = await validateDeveloperKey(developerKey);
          } catch (error) {
            return new Response(
              JSON.stringify({ status: 'error', message: error.message }),
              { status: 403 }
            );
          }

          // Handle other request methods
          if (event.request.method === 'CREATEUSER') {
            const requestData = await event.request.json();
            return createUser(requestData.key, requestData.data, developerStoreName).then(() =>
              new Response(
                JSON.stringify({ status: 'success', message: 'User created successfully.' }),
                { status: 200 }
              )
            );
          } else if (event.request.method === 'SIGNIN') {
            const requestData = await event.request.json();
            return signIn(requestData.key, requestData.data, developerStoreName).then(() =>
              new Response(
                JSON.stringify({ status: 'success', message: 'User signed in.' }),
                { status: 200 }
              )
            );
          } else if (event.request.method === 'SIGNOUT') {
            return signOut(key, developerStoreName).then(() =>
              new Response(
                JSON.stringify({ status: 'success', message: 'User signed out.' }),
                { status: 200 }
              )
            );
          } else if (event.request.method === 'GETAUTH') {
            return getAuth(key, developerStoreName);
          } else if (event.request.method === 'GET') {
            return getDataFromDB(key, developerStoreName);
          } else if (event.request.method === 'POST') {
            const requestData = await event.request.json();
            return storeDataInDB(requestData.key, requestData.data, developerStoreName);
          } else if (event.request.method === 'PUT') {
            const requestData = await event.request.json();
            return updateDataInDB(requestData.key, requestData.data, developerStoreName);
          } else if (event.request.method === 'DELETE') {
            const requestData = await event.request.json();
            if (!requestData.key) {
              return new Response(JSON.stringify({ error: 'Key is required for deletion.' }), { status: 400 });
            }
            return removeDataFromDB(requestData.key, developerStoreName);
          }

          return new Response(JSON.stringify({ error: 'Unsupported method' }), { status: 405 });
        }
      })()
    );
  }
});

// Function to validate developer key
function validateDeveloperKey(developerKey) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      if (!developerKey) {
        return reject(new Error('Developer key not provided.'));
      }

      const transaction = db.transaction('chatStore', 'readonly');
      const store = transaction.objectStore('chatStore');
      const request = store.get('developers/' + developerKey);

      request.onsuccess = (event) => {
        const result = event.target.result;
        if (result && result.data) {
          resolve(result.data.storeName); // Pass store name for further operations
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
function openDB(developerStoreName = 'chatStore') {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ChatDatabase', 1);

    request.onupgradeneeded = function (event) {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('chatStore')) {
        db.createObjectStore('chatStore', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(developerStoreName)) {
        db.createObjectStore(developerStoreName, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(new Error('Error opening the database: ' + event.target.errorCode));
  });
}

// Function to create user
function createUser(authKey, { email, password }, storeName) {
  const userData = { email, password, authenticated: true };
  return storeDataInDB(authKey, userData, storeName);
}

// Function to signIn user
function signIn(authKey, { email, password }, storeName) {
  return openDB(storeName).then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(authKey);

      request.onsuccess = (event) => {
        const result = event.target.result;
        if (result && result.email === email && result.password === password) {
          result.authenticated = true; // Update authentication status
          const updateTransaction = db.transaction(storeName, 'readwrite');
          const updateStore = updateTransaction.objectStore(storeName);
          updateStore.put(result);
          resolve();
        } else {
          reject(new Error('Invalid email or password.'));
        }
      };

      request.onerror = (event) =>
        reject(new Error('Error signing in: ' + event.target.errorCode));
    });
  });
}

// Function to signOut user
function signOut(authKey, storeName) {
  return openDB(storeName).then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.get(authKey);

      request.onsuccess = (event) => {
        const result = event.target.result;
        if (result) {
          result.authenticated = false; // Update authentication status
          store.put(result);
          resolve();
        } else {
          reject(new Error('User not found.'));
        }
      };

      request.onerror = (event) =>
        reject(new Error('Error signing out: ' + event.target.errorCode));
    });
  });
}

// Function to get user authentication
function getAuth(key, storeName) {
  return openDB(storeName).then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
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
function storeDataInDB(key, data, storeName) {
  return openDB(storeName).then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put({ id: key, data });

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(new Error('Error storing data: ' + event.target.errorCode));
    });
  });
}

// Function to store developer in the database
function setDeveloper(key, data, storeName) {
  const developerStoreName = `dev_${data.developerKey}`;

  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('chatStore', 'readwrite');
      const store = transaction.objectStore('chatStore');

      const developerData = { id: key, data: { ...data, storeName: developerStoreName } };
      const request = store.put(developerData);

      request.onsuccess = () => {
        openDB(developerStoreName)
          .then(() => resolve())
          .catch((err) => reject(new Error('Error creating developer object store: ' + err.message)));
      };

      request.onerror = (event) => reject(new Error('Error setting developer: ' + event.target.errorCode));
    });
  });
}

// Function to retrieve data from the database
function getDataFromDB(key = '', storeName) {
  return openDB(storeName).then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);

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
function updateDataInDB(key, newData, storeName) {
  return openDB(storeName).then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      if (!key) {
        reject(new Error('Error updating data. Key not found'));
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
function removeDataFromDB(key, storeName) {
  return openDB(storeName).then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(new Error('Error removing data: ' + event.target.errorCode));
    });
  });
}