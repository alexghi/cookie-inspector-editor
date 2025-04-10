document.addEventListener("DOMContentLoaded", function () {
  const toastElement = document.createElement("div");
  toastElement.className = "toast";
  toastElement.style.display = "none";
  document.body.appendChild(toastElement);

  let currentUrl = "";
  let currentDomain = "";

  const aboutLink = document.getElementById("about-link");
  const aboutModal = document.getElementById("about-modal");
  const closeModalBtn = document.querySelector(".close-modal");

  aboutLink.addEventListener("click", function (e) {
    e.preventDefault();
    aboutModal.style.display = "flex";
  });

  closeModalBtn.addEventListener("click", function () {
    aboutModal.style.display = "none";
  });

  // Close modal when clicking outside of it
  window.addEventListener("click", function (event) {
    if (event.target === aboutModal) {
      aboutModal.style.display = "none";
    }
  });

  // Set up tabs
  function addCopyFunctionality() {
    document.querySelectorAll(".copyable").forEach((el) => {
      el.removeEventListener("click", copyToClipboard);
      el.addEventListener("click", copyToClipboard);
    });
  }

  const originalRenderCookies = globalThis.renderCookies;
  globalThis.renderCookies = function (cookies) {
    if (originalRenderCookies) {
      originalRenderCookies(cookies);
    }
    addCopyFunctionality();
  };

  const originalRenderStorageData = globalThis.renderStorageData;
  globalThis.renderStorageData = function (data) {
    if (originalRenderStorageData) {
      originalRenderStorageData(data);
    }
    addCopyFunctionality();
  };

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".tab")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelectorAll(".tab-content")
        .forEach((c) => c.classList.remove("active"));

      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
    });
  });

  // Set up buttons
  document.getElementById("refresh-btn").addEventListener("click", fetchData);
  document.getElementById("export-btn").addEventListener("click", exportData);
  document
    .getElementById("add-cookie-btn")
    .addEventListener("click", showAddCookieForm);
  document
    .getElementById("add-cookie-cancel")
    .addEventListener("click", hideAddCookieForm);
  document
    .getElementById("add-cookie-save")
    .addEventListener("click", saveNewCookie);
  document
    .getElementById("edit-cookie-cancel")
    .addEventListener("click", hideEditCookieForm);
  document
    .getElementById("edit-cookie-save")
    .addEventListener("click", saveEditedCookie);
  document
    .getElementById("edit-storage-cancel")
    .addEventListener("click", hideEditStorageForm);
  document
    .getElementById("edit-storage-save")
    .addEventListener("click", saveEditedStorage);
  document
    .getElementById("categorize-btn")
    .addEventListener("click", categorizeCookies);

  // Initial data fetch
  fetchData();

  function fetchData() {
    // Hide all forms
    hideAddCookieForm();
    hideEditCookieForm();
    hideEditStorageForm();

    // Reset loading states
    document.getElementById("cookies-loading").style.display = "block";
    document.getElementById("cookies-tbody").innerHTML = "";
    document.getElementById("localStorage-tbody").innerHTML = "";
    document.getElementById("sessionStorage-tbody").innerHTML = "";

    // Execute script in active tab to get data
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      currentUrl = tabs[0].url;
      const urlObj = new URL(currentUrl);
      currentDomain = urlObj.hostname;

      // Get domain for the "Add Cookie" form
      document.getElementById(
        "new-cookie-domain"
      ).placeholder = `Domain (default: ${currentDomain})`;

      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[0].id },
          function: getStorageData,
        },
        function (results) {
          if (chrome.runtime.lastError || !results || !results[0]) {
            document.getElementById("cookies-loading").style.display = "none";
            document.getElementById("cookies-tbody").innerHTML =
              '<tr><td colspan="5" class="empty-message">Error accessing page data</td></tr>';
            return;
          }

          const data = results[0].result;
          renderStorageData(data);
        }
      );

      // Additionally get cookies via the cookies API
      chrome.cookies.getAll({ url: tabs[0].url }, function (cookies) {
        const detailedCookies = cookies.map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          expirationDate: cookie.expirationDate,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite,
        }));

        // Store for export
        window.detailedCookies = detailedCookies;

        // Render detailed cookies
        renderCookies(detailedCookies);
      });
    });
  }

  function renderCookies(cookies) {
    document.getElementById("cookies-loading").style.display = "none";
    const tbody = document.getElementById("cookies-tbody");

    if (cookies.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="empty-message">No cookies found</td></tr>';
      document.getElementById("cookies-count").textContent = "0";
      return;
    }

    tbody.innerHTML = "";
    cookies.forEach((cookie, index) => {
      const row = document.createElement("tr");

      const nameCell = document.createElement("td");
      nameCell.textContent = cookie.name;
      row.appendChild(nameCell);

      const valueCell = document.createElement("td");
      valueCell.classList.add("value-cell", "copyable");
      valueCell.textContent =
        cookie.value.length > 50
          ? cookie.value.substring(0, 47) + "..."
          : cookie.value;
      valueCell.title = "Click to copy: " + cookie.value;
      valueCell.dataset.copyText = cookie.value;
      valueCell.addEventListener("click", copyToClipboard);
      row.appendChild(valueCell);

      const domainCell = document.createElement("td");
      domainCell.textContent = cookie.domain;
      domainCell.classList.add("copyable");
      domainCell.title = "Click to copy: " + cookie.domain;
      domainCell.dataset.copyText = cookie.domain;
      domainCell.addEventListener("click", copyToClipboard);
      row.appendChild(domainCell);

      const expiresCell = document.createElement("td");
      if (cookie.expirationDate) {
        const expiryDate = new Date(cookie.expirationDate * 1000);
        expiresCell.textContent =
          expiryDate.toLocaleDateString() +
          " " +
          expiryDate.toLocaleTimeString();
      } else {
        expiresCell.textContent = "Session";
      }
      row.appendChild(expiresCell);

      const actionsCell = document.createElement("td");

      const editBtn = document.createElement("button");
      editBtn.textContent = "Edit";
      editBtn.className = "action-button edit-button";

      // Disable edit button for httpOnly cookies and add tooltip
      if (cookie.httpOnly) {
        editBtn.disabled = true;
        editBtn.classList.add("disabled");
        editBtn.title = "HTTP-Only cookies cannot be edited by extensions";
        editBtn.style.opacity = "0.5";
        editBtn.style.cursor = "not-allowed";
      } else {
        editBtn.addEventListener("click", () => editCookie(cookie, index));
      }

      actionsCell.appendChild(editBtn);

      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "Delete";
      deleteBtn.className = "action-button delete-button";
      deleteBtn.addEventListener("click", () => deleteCookie(cookie));
      actionsCell.appendChild(deleteBtn);

      row.appendChild(actionsCell);

      tbody.appendChild(row);
    });

    document.getElementById("cookies-count").textContent = cookies.length;
  }

  function renderStorageData(data) {
    // Local Storage
    const localStorageTbody = document.getElementById("localStorage-tbody");
    localStorageTbody.innerHTML = "";

    const localStorageEntries = Object.entries(data.localStorage || {});
    document.getElementById("localStorage-count").textContent =
      localStorageEntries.length;

    if (localStorageEntries.length === 0) {
      localStorageTbody.innerHTML =
        '<tr><td colspan="3" class="empty-message">No localStorage items found</td></tr>';
    } else {
      localStorageEntries.forEach(([key, value]) => {
        const row = document.createElement("tr");

        const keyCell = document.createElement("td");
        keyCell.textContent = key;
        keyCell.classList.add("copyable");
        keyCell.title = "Click to copy: " + key;
        keyCell.dataset.copyText = key;
        keyCell.addEventListener("click", copyToClipboard);
        row.appendChild(keyCell);

        const valueCell = document.createElement("td");
        valueCell.classList.add("value-cell", "copyable");
        valueCell.textContent =
          value.length > 100 ? value.substring(0, 97) + "..." : value;
        valueCell.title = "Click to copy: " + value;
        valueCell.dataset.copyText = value;
        valueCell.addEventListener("click", copyToClipboard);
        row.appendChild(valueCell);

        const actionsCell = document.createElement("td");

        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.className = "action-button edit-button";
        editBtn.addEventListener("click", () =>
          editStorageItem("localStorage", key, value)
        );
        actionsCell.appendChild(editBtn);

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.className = "action-button delete-button";
        deleteBtn.addEventListener("click", () =>
          deleteStorageItem("localStorage", key)
        );
        actionsCell.appendChild(deleteBtn);

        row.appendChild(actionsCell);

        localStorageTbody.appendChild(row);
      });
    }

    // Session Storage
    const sessionStorageTbody = document.getElementById("sessionStorage-tbody");
    sessionStorageTbody.innerHTML = "";

    const sessionStorageEntries = Object.entries(data.sessionStorage || {});
    document.getElementById("sessionStorage-count").textContent =
      sessionStorageEntries.length;

    if (sessionStorageEntries.length === 0) {
      sessionStorageTbody.innerHTML =
        '<tr><td colspan="3" class="empty-message">No sessionStorage items found</td></tr>';
    } else {
      sessionStorageEntries.forEach(([key, value]) => {
        const row = document.createElement("tr");

        const keyCell = document.createElement("td");
        keyCell.textContent = key;
        row.appendChild(keyCell);

        const valueCell = document.createElement("td");
        valueCell.classList.add("value-cell");
        valueCell.textContent =
          value.length > 100 ? value.substring(0, 97) + "..." : value;
        valueCell.title = value;
        row.appendChild(valueCell);

        const actionsCell = document.createElement("td");

        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit";
        editBtn.className = "action-button edit-button";
        editBtn.addEventListener("click", () =>
          editStorageItem("sessionStorage", key, value)
        );
        actionsCell.appendChild(editBtn);

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete";
        deleteBtn.className = "action-button delete-button";
        deleteBtn.addEventListener("click", () =>
          deleteStorageItem("sessionStorage", key)
        );
        actionsCell.appendChild(deleteBtn);

        row.appendChild(actionsCell);

        sessionStorageTbody.appendChild(row);
      });
    }

    // Store data for export
    window.storageData = data;
  }

  function showAddCookieForm() {
    document.getElementById("add-cookie-form").style.display = "block";
  document.getElementById("edit-cookie-form").style.display = "none";
  document.getElementById("edit-storage-form").style.display = "none";


  document.getElementById("new-cookie-name").value = "";
  document.getElementById("new-cookie-value").value = "";
  document.getElementById("new-cookie-domain").value = "";
  document.getElementById("new-cookie-path").value = "/";
  document.getElementById("new-cookie-expiry").value = "";
  document.getElementById("new-cookie-secure").checked = true;
  document.getElementById("new-cookie-httponly").checked = false;
  document.getElementById("new-cookie-samesite").value = "lax";
  }

  function hideAddCookieForm() {
    document.getElementById("add-cookie-form").style.display = "none";
  }

  function saveNewCookie() {
    const name = document.getElementById("new-cookie-name").value.trim();
    const value = document.getElementById("new-cookie-value").value;
    let domain = document.getElementById("new-cookie-domain").value.trim();
    const path = document.getElementById("new-cookie-path").value.trim() || "/";
    const expiryDays = document.getElementById("new-cookie-expiry").value.trim();
    const secure = document.getElementById("new-cookie-secure").checked;
    const httpOnly = document.getElementById("new-cookie-httponly").checked;
    let sameSite = document.getElementById("new-cookie-samesite").value;

    // Validation
  if (!name) {
    alert("Cookie name is required");
    return;
  }
  
  if (!sameSite) {
    sameSite = "lax";
  }
  
  if (sameSite === "none") {
    sameSite = "no_restriction";
  }

    if (!domain) {
      domain = currentDomain;
    }

    // Create proper URL from domain
    const urlForCookie =
      (secure ? "https://" : "http://") +
      (domain.startsWith(".") ? domain.substring(1) : domain) +
      (path.startsWith("/") ? path : "/" + path);

    // Only set domain if it starts with a dot (to make it a wildcard domain)
    const cookieData = {
      name: name,
      value: value,
      url: urlForCookie,
      path: path,
      secure: secure,
      sameSite: sameSite,
    };

    // Only include domain if it starts with a dot
    if (domain.startsWith(".")) {
      cookieData.domain = domain;
    }

    // Add expiration if provided
    if (expiryDays && !isNaN(expiryDays)) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + parseInt(expiryDays));
      cookieData.expirationDate = Math.floor(expirationDate.getTime() / 1000);
    }

    // httpOnly cookies cannot be set by extensions
    if (httpOnly) {
      alert(
        "Note: httpOnly flag can only be set by servers, not by extensions. " +
          "This option will be ignored."
      );
    }

    console.log("Setting cookie with data:", cookieData);

    chrome.cookies.set(cookieData, function (cookie) {
      if (chrome.runtime.lastError) {
        console.error("Error setting cookie:", chrome.runtime.lastError);
        alert("Error setting cookie: " + chrome.runtime.lastError.message);
      } else if (!cookie) {
        alert(
          "Failed to create cookie. This might be due to browser restrictions."
        );
      } else {
        hideAddCookieForm();
        fetchData(); // Refresh data
      }
    });
  }

  function editCookie(cookie, index) {
    document.getElementById("add-cookie-form").style.display = "none";
    document.getElementById("edit-cookie-form").style.display = "block";
    document.getElementById("edit-storage-form").style.display = "none";

    document.getElementById("edit-cookie-id").value = index;
    document.getElementById("edit-cookie-name").value = cookie.name;
    document.getElementById("edit-cookie-value").value = cookie.value;
    document.getElementById("edit-cookie-domain").value = cookie.domain;
    document.getElementById("edit-cookie-path").value = cookie.path || "/";

    if (cookie.expirationDate) {
      const now = new Date();
      const expiryDate = new Date(cookie.expirationDate * 1000);
      const diffDays = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
      document.getElementById("edit-cookie-expiry").value =
        diffDays > 0 ? diffDays : "";
    } else {
      document.getElementById("edit-cookie-expiry").value = "";
    }

    document.getElementById("edit-cookie-secure").checked = cookie.secure;
    document.getElementById("edit-cookie-httponly").checked = cookie.httpOnly;
    document.getElementById("edit-cookie-samesite").value =
      cookie.sameSite?.toLowerCase() || "lax";
  }

  function hideEditCookieForm() {
    document.getElementById("edit-cookie-form").style.display = "none";
  }

  function saveEditedCookie() {

    const name = document.getElementById("edit-cookie-name").value.trim();
    const value = document.getElementById("edit-cookie-value").value;
    const domain = document.getElementById("edit-cookie-domain").value.trim();
    const path = document.getElementById("edit-cookie-path").value.trim() || "/";
    const expiryDays = document.getElementById("edit-cookie-expiry").value.trim();
    const secure = document.getElementById("edit-cookie-secure").checked;
    const httpOnly = document.getElementById("edit-cookie-httponly").checked;
    let sameSite = document.getElementById("edit-cookie-samesite").value;
     
  // Validation
  if (!name) {
    alert("Cookie name is required");
    return;
  }
  
  // Ensure sameSite has a default value
  if (!sameSite) {
    sameSite = "lax";
  }
  
  if (sameSite === "none") {
    sameSite = "no_restriction";
  }

    const cookieUrl = currentUrl; // Use the current tab URL

    // Try to delete with the exact current URL first
    chrome.cookies.remove(
      {
        url: cookieUrl,
        name: name,
      },
      function (removeDetails) {
        // Now set the new cookie
        const cookieData = {
          name: name,
          value: value,
          url: cookieUrl,
          path: path,
          secure: secure,
          sameSite: sameSite,
        };

        // Only set domain if it's provided and starts with a dot
        if (domain && domain.startsWith(".")) {
          cookieData.domain = domain;
        }

        // Add expiration if provided
        if (expiryDays && !isNaN(expiryDays)) {
          const expirationDate = new Date();
          expirationDate.setDate(
            expirationDate.getDate() + parseInt(expiryDays)
          );
          cookieData.expirationDate = Math.floor(
            expirationDate.getTime() / 1000
          );
        }

        // Note: httpOnly cookies cannot be set by extension
        if (httpOnly) {
          console.warn(
            "httpOnly flag can only be set by servers, not extensions"
          );
        }

        // Log what we're trying to set
        console.log("Setting cookie with data:", cookieData);

        chrome.cookies.set(cookieData, function (cookie) {
          if (chrome.runtime.lastError) {
            console.error("Error setting cookie:", chrome.runtime.lastError);

            // Try an alternative approach - strip the path from URL
            const urlParts = cookieUrl.split("/");
            const baseUrl = urlParts[0] + "//" + urlParts[2]; // http(s)://domain.com

            cookieData.url = baseUrl;
            console.log("Trying alternative URL:", baseUrl);

            chrome.cookies.set(cookieData, function (cookie2) {
              if (chrome.runtime.lastError) {
                console.error(
                  "Error on second attempt:",
                  chrome.runtime.lastError
                );
                alert(
                  "Error updating cookie: " +
                    chrome.runtime.lastError.message +
                    "\n\nTry refreshing the page and editing again."
                );
              } else if (!cookie2) {
                alert(
                  "Failed to update cookie. This might be due to browser restrictions."
                );
              } else {
                hideEditCookieForm();
                fetchData(); // Refresh data
              }
            });
          } else if (!cookie) {
            alert(
              "Failed to update cookie. This might be due to browser restrictions."
            );
          } else {
            hideEditCookieForm();
            fetchData(); // Refresh data
          }
        });
      }
    );
  }

  function deleteCookie(cookie) {
    if (
      confirm(`Are you sure you want to delete the cookie "${cookie.name}"?`)
    ) {
      // Calculate the correct URL for removal (must match domain and path)
      let urlToUse = "";
      if (cookie.domain.startsWith(".")) {
        // For cookies with domain starting with dot, use a subdomain
        urlToUse =
          (cookie.secure ? "https://" : "http://") +
          cookie.domain.substring(1) +
          cookie.path;
      } else {
        // For cookies with explicit domain
        urlToUse =
          (cookie.secure ? "https://" : "http://") +
          cookie.domain +
          cookie.path;
      }

      chrome.cookies.remove(
        {
          url: urlToUse,
          name: cookie.name,
        },
        function (removeInfo) {
          if (chrome.runtime.lastError) {
            console.error("Error removing cookie:", chrome.runtime.lastError);
            alert("Error removing cookie: " + chrome.runtime.lastError.message);
          } else if (!removeInfo) {
            console.warn("Cookie not found or could not be removed");
            alert(
              "Cookie could not be removed. It might not exist or browser restrictions prevent removal."
            );
          }
          fetchData(); // Refresh data
        }
      );
    }
  }

  function editStorageItem(storageType, key, value) {
    document.getElementById("add-cookie-form").style.display = "none";
    document.getElementById("edit-cookie-form").style.display = "none";
    document.getElementById("edit-storage-form").style.display = "block";

    document.getElementById("edit-storage-type").value = storageType;
    document.getElementById("edit-storage-key").value = key;
    document.getElementById("edit-storage-value").value = value;
  }

  function hideEditStorageForm() {
    document.getElementById("edit-storage-form").style.display = "none";
  }

  function saveEditedStorage() {
    const storageType = document.getElementById("edit-storage-type").value;
    const key = document.getElementById("edit-storage-key").value;
    const value = document.getElementById("edit-storage-value").value;

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[0].id },
          function: updateStorageItem,
          args: [storageType, key, value],
        },
        function (results) {
          if (chrome.runtime.lastError) {
            console.error("Error executing script:", chrome.runtime.lastError);
            alert(
              "Error updating storage: " + chrome.runtime.lastError.message
            );
          } else if (results && results[0] && results[0].result) {
            const result = results[0].result;
            if (!result.success) {
              alert(
                "Error updating storage: " + (result.error || "Unknown error")
              );
            } else {
              hideEditStorageForm();
              fetchData(); // Refresh data
            }
          } else {
            console.error("Unexpected result from script execution:", results);
            alert("Error updating storage: Unexpected response");
          }
        }
      );
    });
  }

  function deleteStorageItem(storageType, key) {
    if (
      confirm(
        `Are you sure you want to delete the ${storageType} item "${key}"?`
      )
    ) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.scripting.executeScript(
          {
            target: { tabId: tabs[0].id },
            function: removeStorageItem,
            args: [storageType, key],
          },
          function (results) {
            if (chrome.runtime.lastError) {
              console.error(
                "Error executing script:",
                chrome.runtime.lastError
              );
              alert(
                "Error removing storage item: " +
                  chrome.runtime.lastError.message
              );
            } else if (results && results[0] && results[0].result) {
              const result = results[0].result;
              if (!result.success) {
                alert(
                  "Error removing storage item: " +
                    (result.error || "Unknown error")
                );
              }
            }
            fetchData(); // Refresh data regardless
          }
        );
      });
    }
  }

  function exportData() {
    const exportData = {
      cookies: window.detailedCookies || [],
      localStorage: window.storageData?.localStorage || {},
      sessionStorage: window.storageData?.sessionStorage || {},
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

    const exportFileDefaultName = "cookie-inspector-export.json";

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  }

  function categorizeCookies() {
    const cookies = window.detailedCookies || [];
    const categorized = {
      essential: [],
      functional: [],
      analytics: [],
      advertising: [],
      unknown: [],
    };

    // Common cookie patterns for categorization
    const patterns = {
      essential: [
        /^connect\.sid$/i,
        /^session$/i,
        /^csrf/i,
        /^xsrf/i,
        /^token$/i,
        /^auth/i,
        /^logged_in$/i,
        /_session$/i,
        /^(__cfduid|cf_clearance)$/i,
      ],
      functional: [
        /^preferences$/i,
        /^settings$/i,
        /^language$/i,
        /^currency$/i,
        /^ui$/i,
        /^user-settings$/i,
        /^cookie_consent$/i,
        /^cc_/i,
        /^selected-ui$/i,
      ],
      analytics: [
        /^_ga$/i,
        /^_gid$/i,
        /^_gat$/i,
        /^__utm/i,
        /^_pk_/i,
        /^amplitude/i,
        /^mp_/i,
        /^mixpanel/i,
        /^keen/i,
        /^km_/i,
        /^hotjar/i,
        /^_hj/i,
        /^plausible/i,
        /^_sp_/i,
        /^_sp$/i,
        /^sa_/i,
        /^sc_/i,
        /^ajs_/i,
        /^apt\.sid$/i,
        /^apt\.uid$/i,
        /^GAESA$/i,
      ],
      advertising: [
        /^__gads$/i,
        /^IDE$/i,
        /^test_cookie$/i,
        /^__qca$/i,
        /^_fbp$/i,
        /^fr$/i,
        /^_gcl_/i,
        /^NID$/i,
        /^PREF$/i,
        /^datr$/i,
        /^sb$/i,
        /^uetsid$/i,
        /^_pinterest/i,
        /^_pin_unauth$/i,
        /^ad-id$/i,
        /^ad_token$/i,
        /^anj$/i,
        /^atidvisitor$/i,
        /^visitor_id/i,
      ],
    };

    // Categorize each cookie
    cookies.forEach((cookie) => {
      let isCategorized = false;

      // Check against each pattern
      for (const [category, regexList] of Object.entries(patterns)) {
        for (const regex of regexList) {
          if (regex.test(cookie.name)) {
            categorized[category].push(cookie);
            isCategorized = true;
            break;
          }
        }
        if (isCategorized) break;
      }

      // If not matched to any category
      if (!isCategorized) {
        categorized.unknown.push(cookie);
      }
    });

    // Display results
    const categorizeSection = document.getElementById("categorize-section");
    categorizeSection.style.display = "block";

    const resultsContainer = document.getElementById("categorize-results");
    resultsContainer.innerHTML = "";

    // Helper to create category section
    function createCategorySection(title, cookies, categoryClass) {
      const section = document.createElement("div");
      section.style.marginBottom = "16px";

      const header = document.createElement("h4");
      header.style.margin = "8px 0";
      header.innerHTML = `${title} <span class="count-badge">${cookies.length}</span>`;
      section.appendChild(header);

      if (cookies.length === 0) {
        const emptyMsg = document.createElement("p");
        emptyMsg.className = "empty-message";
        emptyMsg.textContent = "No cookies in this category";
        section.appendChild(emptyMsg);
      } else {
        cookies.forEach((cookie) => {
          const cookieItem = document.createElement("div");
          cookieItem.style.marginBottom = "4px";

          const categoryBadge = document.createElement("span");
          categoryBadge.className = `category ${categoryClass}`;
          categoryBadge.textContent = title;
          cookieItem.appendChild(categoryBadge);

          const cookieName = document.createTextNode(` ${cookie.name}`);
          cookieItem.appendChild(cookieName);

          section.appendChild(cookieItem);
        });
      }

      return section;
    }

    // Add each category
    resultsContainer.appendChild(
      createCategorySection("Essential", categorized.essential, "essential")
    );
    resultsContainer.appendChild(
      createCategorySection("Functional", categorized.functional, "functional")
    );
    resultsContainer.appendChild(
      createCategorySection("Analytics", categorized.analytics, "analytics")
    );
    resultsContainer.appendChild(
      createCategorySection(
        "Advertising",
        categorized.advertising,
        "advertising"
      )
    );
    resultsContainer.appendChild(
      createCategorySection("Unknown", categorized.unknown, "unknown")
    );

    // Add CookieYes export info
    const exportSection = document.createElement("div");
    exportSection.style.marginTop = "16px";
    exportSection.style.borderTop = "1px solid #ddd";
    exportSection.style.paddingTop = "16px";

    const exportHeader = document.createElement("h4");
    exportHeader.textContent = "CookieYes Configuration";
    exportSection.appendChild(exportHeader);

    const exportInfo = document.createElement("p");
    exportInfo.textContent =
      "Use this categorization to configure your CookieYes cookie banner. " +
      "Copy the cookie names from each category into your CookieYes dashboard.";
    exportSection.appendChild(exportInfo);

    resultsContainer.appendChild(exportSection);
  }
});

// This function runs in the context of the page
function getStorageData() {
  // Get local storage
  const localStorage = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    localStorage[key] = window.localStorage.getItem(key);
  }

  // Get session storage
  const sessionStorage = {};
  for (let i = 0; i < window.sessionStorage.length; i++) {
    const key = window.sessionStorage.key(i);
    sessionStorage[key] = window.sessionStorage.getItem(key);
  }

  return {
    localStorage,
    sessionStorage,
  };
}

// This function runs in the context of the page
function updateStorageItem(storageType, key, value) {
  try {
    if (storageType === "localStorage") {
      window.localStorage.setItem(key, value);
    } else if (storageType === "sessionStorage") {
      window.sessionStorage.setItem(key, value);
    }
    return { success: true };
  } catch (error) {
    console.error("Error updating storage:", error);
    return { success: false, error: error.message };
  }
}

// This function runs in the context of the page
function removeStorageItem(storageType, key) {
  try {
    if (storageType === "localStorage") {
      window.localStorage.removeItem(key);
    } else if (storageType === "sessionStorage") {
      window.sessionStorage.removeItem(key);
    }
    return { success: true };
  } catch (error) {
    console.error("Error removing storage item:", error);
    return { success: false, error: error.message };
  }
}

function copyToClipboard(event) {
  const text = event.currentTarget.dataset.copyText;

  // Highlight the element immediately for user feedback
  const element = event.currentTarget;
  element.style.backgroundColor = "#e8f0fe";

  try {
    // Use clipboard API
    navigator.clipboard
      .writeText(text)
      .then(() => {
        // Show success message using simple approach
        showSimpleToast(
          `Copied: ${text.length > 30 ? text.substring(0, 27) + "..." : text}`
        );
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
        showSimpleToast("Failed to copy to clipboard");
      });
  } catch (err) {
    console.error("Clipboard API error: ", err);
    showSimpleToast("Failed to copy to clipboard");
  }

  // Reset highlight after delay regardless of copy success
  setTimeout(() => {
    element.style.backgroundColor = "";
  }, 1000);
}

function showSimpleToast(message) {
  // Create a new toast each time to avoid any issues with existing elements
  let toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  toast.style.opacity = "0";
  toast.style.display = "block";
  document.body.appendChild(toast);

  // Trigger reflow to enable transition
  void toast.offsetWidth;

  // Show the toast
  toast.style.opacity = "1";

  // Hide and remove after delay
  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => {
      // Remove from DOM when done
      if (toast && toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 2000);
}

window.copyToClipboard = copyToClipboard;
