// Fetch event listener for the service worker
self.addEventListener('fetch', function (event) {
  console.log('Fetch event for:', event.request.url);
  const url = new URL(event.request.url);
  const key = url.searchParams.get('key'); // Extract the key from the query parameter

  if (url.pathname.endsWith('/db-worker')) {
    if (event.request.method === 'GET') {
      event.respondWith(getDataFromDB(key));
    } else if (event.request.method === 'POST') {
      event.respondWith(
        event.request.json().then((data) =>
          storeDataInDB(data.key, data.data).then(() =>
            new Response(JSON.stringify({ status: 'success', message: 'Data stored!' }))
          )
        )
      );
    } else if (event.request.method === 'PUT') {
      event.respondWith(
        event.request.json().then((data) =>
          updateDataInDB(data.key, data.data).then(() =>
            new Response(JSON.stringify({ status: 'success', message: 'Data updated!' }))
          )
        )
      );
    } else if (event.request.method === 'DELETE') {
      event.respondWith(
        event.request.json().then((data) => {
          if (data.key) {
            return removeDataFromDB(data.key).then(() =>
              new Response(JSON.stringify({ status: 'success', message: 'Data removed by key!' }))
            );
          } else {
            return new Response(JSON.stringify({ error: 'Key is required for deletion.' }), { status: 400 });
          }
        })
      );
    }
  }
});

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