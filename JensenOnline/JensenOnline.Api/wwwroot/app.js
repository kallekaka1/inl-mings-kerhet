const el = (id) => document.getElementById(id);
let user = null;
let cart = [];
let editingProductId = null;
const money = (value) => new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK" }).format(value);

function showAccount(register = false) {
  el("loginForm").hidden = register;
  el("registerForm").hidden = !register;
  el("loginTab").setAttribute("aria-pressed", String(!register));
  el("registerTab").setAttribute("aria-pressed", String(register));
  el("accountTitle").textContent = register ? "Din nästa favorit väntar." : "Välkommen tillbaka.";
}

function goToAccount() {
  showAccount();
  el("loginBox").scrollIntoView({ block: "start" });
  el("loginEmail").focus({ preventScroll: true });
}

// Decorative line drawings only. Product data always comes from the API.
function productArt(name, parent) {
  const art = add("div", "", parent);
  art.className = "product-art";
  art.setAttribute("aria-hidden", "true");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  const paths = [
    [/mus/i, "M20 28a12 12 0 0 1 24 0v13a12 12 0 0 1-24 0V28 M32 16v14 M20 31h24"],
    [/tangentbord/i, "M7 20h50v27H7z M13 27h38 M13 33h38 M13 39h6m5 0h16m5 0h6"],
    [/hörlur/i, "M13 36V28a19 19 0 0 1 38 0v8 M13 31h7v20h-7z M44 31h7v20h-7z"],
    [/laptop|dator/i, "M12 13h40v29H12z M7 49l5-7h40l5 7z M27 46h10"],
    [/skärm/i, "M7 10h50v34H7z M32 44v10 M22 54h20 M11 37h42"],
    [/hubb|ssd/i, "M13 20h38v28H13z M21 27h5m7 0h5 M20 39h24 M32 20V9h10"],
    [/kamera/i, "M12 20h40v24H12z M39 32a7 7 0 1 1-14 0 7 7 0 0 1 14 0 M32 44v9 M22 53h20"],
    [/stol/i, "M20 10h24v25H20z M16 35h32v8H16z M32 43v11 M19 55l13-4 13 4"],
    [/lampa/i, "M15 54h34 M32 54V31l13-14 M36 12l14 14 7-7-14-14z"],
  ];
  const d = paths.find(([pattern]) => pattern.test(name))?.[1] || "M12 19l20-9 20 9v27L32 56 12 46z M12 19l20 10 20-10 M32 29v27 M22 14l20 10";
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  svg.appendChild(path);
  art.appendChild(svg);
}

function friendlyError(error) {
  const text = error.message;
  const translations = {
    "Order must contain 1-25 items.": "En order behöver innehålla mellan 1 och 25 olika produkter.",
    "Invalid order items.": "Kontrollera att antalet är mellan 1 och 100 för varje produkt.",
    "Duplicate products are not allowed.": "Samma produkt får bara finnas på en rad i ordern.",
    "One or more products do not exist.": "En produkt finns inte längre. Ta bort den från kundvagnen och försök igen.",
  };
  if (Object.hasOwn(translations, text)) return translations[text];
  if (/HTTP 404|Not Found/i.test(text)) return "Det du söker kunde inte hittas. Uppdatera sidan och försök igen.";
  if (/Invalid credentials|HTTP 401/.test(text)) return "Inloggningen misslyckades eller har gått ut. Kontrollera dina uppgifter och försök igen. Kontot kan vara tillfälligt låst.";
  if (/HTTP 403/.test(text)) return "Du har inte behörighet att utföra åtgärden.";
  if (/HTTP 400|validation errors/i.test(text)) return "Kontrollera uppgifterna. Vid registrering behöver e-postadressen vara ledig och lösenordet uppfylla kraven.";
  if (/fetch|network|load failed/i.test(text)) return "Det gick inte att nå butiken. Kontrollera anslutningen och försök igen.";
  if (/HTTP 5|An error occurred|Could not assign/i.test(text)) return "Något gick fel. Försök igen om en stund.";
  return text;
}

function message(text) {
  el("notice").textContent = text;
  el("notice").classList.toggle("error", text.startsWith("Fel:"));
}

function add(tag, text, parent) {
  const element = document.createElement(tag);
  element.textContent = String(text);
  parent.appendChild(element);
  return element;
}

async function api(path, method = "GET", data) {
  const headers = {};

  if (data !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (method !== "GET") {
    const csrfResponse = await fetch("/api/security/csrf");
    if (!csrfResponse.ok) throw Error("CSRF-token kunde inte hämtas.");
    const csrf = await csrfResponse.json();
    headers["X-CSRF-TOKEN"] = csrf.csrfToken;
  }

  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers,
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw Error(
      result?.message || result?.title || `HTTP ${response.status}`,
    );
  }

  return result;
}

async function run(action) {
  try {
    await action();
  } catch (error) {
    message("Fel: " + friendlyError(error));
  }
}

function formData(form) {
  return Object.fromEntries(new FormData(form));
}

async function refreshSession() {
  try {
    user = await api("/api/auth/me");
  } catch {
    user = null;
  }

  const isAdmin = user?.roles?.includes("Admin");

  el("identity").textContent = user
    ? `${user.email} · ${isAdmin ? "Administratör" : "Kund"}`
    : "Inte inloggad";

  el("loginBox").hidden = !!user;
  el("logoutBox").hidden = !user;
  el("customerArea").hidden = !user;
  el("adminArea").hidden = !isAdmin;
  el("accountButton").hidden = !!user;
  el("ordersLink").hidden = !user;
  el("adminLink").hidden = !isAdmin;

  await loadProducts();

  if (user) await loadOrders();
}

async function loadProducts() {
  const search = encodeURIComponent(el("search").value.trim());
  el("products").setAttribute("aria-busy", "true");
  let products;
  try {
    products = await api("/api/products?search=" + search);
  } catch (error) {
    el("products").replaceChildren();
    const empty = add("div", "", el("products"));
    empty.className = "empty-state";
    add("h3", "Sortimentet kunde inte hämtas", empty);
    add("p", "Försök igen om en stund.", empty);
    add("button", "Försök igen", empty).onclick = () => run(loadProducts);
    el("productCount").textContent = "";
    throw error;
  } finally {
    el("products").setAttribute("aria-busy", "false");
  }
  const container = el("products");
  container.replaceChildren();

  el("productCount").textContent = `${products.length} ${products.length === 1 ? "produkt" : "produkter"}`;
  if (!products.length) {
    const empty = add("div", "", container);
    empty.className = "empty-state";
    add("h3", search ? "Inga träffar den här gången" : "Här kommer snart mer teknik", empty);
    add("p", search ? "Prova ett annat produktnamn eller visa hela sortimentet." : "Det finns inga produkter i sortimentet ännu.", empty);
    if (search) add("button", "Visa alla produkter", empty).onclick = () => {
      el("search").value = "";
      run(loadProducts);
    };
  }

  for (const product of products) {
    const card = add("div", "", container);
    card.className = "card";

    productArt(product.name, card);
    const body = add("div", "", card);
    body.className = "product-body";
    add("h3", product.name, body);
    add("p", product.description, body).className = "product-description";
    add("strong", money(product.price), body).className = "price";

    if (user) {
      const quantity = document.createElement("input");
      quantity.type = "number";
      quantity.min = "1";
      quantity.max = "100";
      quantity.value = "1";
      quantity.setAttribute("aria-label", `Antal ${product.name}`);
      const actions = add("div", "", body);
      actions.className = "buy-actions";
      actions.appendChild(quantity);
      const button = add("button", "Lägg i kundvagn", actions);
      button.onclick = () => {
        const amount = Number(quantity.value);

        if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
          message("Antal måste vara mellan 1 och 100.");
          return;
        }

        const existing = cart.find((x) => x.id === product.id);

        if (existing) {
          if (existing.quantity + amount > 100) {
            message("Max 100 av samma produkt.");
            return;
          }
          existing.quantity += amount;
        } else {
          if (cart.length >= 25) {
            message("Max 25 olika produkter.");
            return;
          }
          cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: amount,
          });
        }

        drawCart();
        message("Produkten har lagts i kundvagnen.");
      };
    }

    if (!user) {
      const login = add("button", "Logga in för att handla", body);
      login.className = "secondary";
      login.onclick = goToAccount;
    }

    if (user?.roles?.includes("Admin")) {
      const edit = add("button", "Ändra produkt", body);
      edit.className = "secondary edit-button";
      edit.onclick = () => {
        editingProductId = product.id;
        el("editName").value = product.name;
        el("editDescription").value = product.description;
        el("editPrice").value = product.price;
        el("editError").textContent = "";
        el("editDialog").showModal();
      };
    }
  }
}

function drawCart() {
  const container = el("cart");
  container.replaceChildren();

  for (const item of cart) {
    const row = add("div", "", container);
    row.className = "line cart-line";
    const details = add("div", "", row);
    add("strong", item.name, details);
    add("p", `${item.quantity} st × ${money(item.price)} · ${money(item.price * item.quantity)}`, details);
    const remove = add("button", "Ta bort", row);
    remove.className = "quiet remove-button";
    remove.setAttribute("aria-label", `Ta bort ${item.name}`);
    remove.onclick = () => {
      cart = cart.filter((x) => x.id !== item.id);
      drawCart();
    };
  }

  if (!cart.length) add("p", "Kundvagnen är tom.", container);

  const total = cart.reduce((sum, x) => sum + x.price * x.quantity, 0);
  el("cartTotal").textContent =
    `Uppskattat totalpris: ${money(total)}`;
  el("cartCount").textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
  el("checkoutButton").disabled = !cart.length;
}

async function loadOrders() {
  const orders = await api("/api/orders");
  const container = el("orders");
  container.replaceChildren();

  if (!orders.length) add("p", "Du har inga order.", container);

  for (const order of orders) {
    const row = add("div", "", container);
    row.className = "line";
    const heading = add("div", "", row);
    heading.className = "order-heading";
    add("strong", `Order #${order.id}`, heading);
    add("strong", money(order.totalPrice), heading);
    add("p", new Date(order.createdAt).toLocaleDateString("sv-SE"), row).className = "order-date";
    for (const item of order.items) {
      add("p", `${item.productName} × ${item.quantity}`, row).className = "order-item";
    }
  }
}

el("registerForm").onsubmit = (event) => {
  event.preventDefault();
  run(async () => {
    await api("/api/auth/register", "POST", formData(event.target));
    event.target.reset();
    message("Konto skapat och inloggad.");
    await refreshSession();
  });
};

el("loginForm").onsubmit = (event) => {
  event.preventDefault();
  run(async () => {
    await api("/api/auth/login", "POST", formData(event.target));
    event.target.reset();
    message("Inloggningen lyckades.");
    await refreshSession();
  });
};

el("logoutButton").onclick = () =>
  run(async () => {
    await api("/api/auth/logout", "POST");
    user = null;
    cart = [];
    drawCart();
    message("Du är utloggad.");
    await refreshSession();
  });

el("searchForm").onsubmit = (event) => {
  event.preventDefault();
  run(loadProducts);
};

el("productForm").onsubmit = (event) => {
  event.preventDefault();
  run(async () => {
    const values = formData(event.target);
    await api("/api/products", "POST", {
      ...values,
      price: Number(values.price),
    });

    event.target.reset();
    message("Produkten skapad.");
    await loadProducts();
  });
};

el("checkoutButton").onclick = () =>
  run(async () => {
    if (!cart.length) {
      message("Kundvagnen är tom.");
      return;
    }

    await api("/api/orders", "POST", {
      items: cart.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
      })),
    });

    cart = [];
    drawCart();
    message("Ordern skapades!");
    await loadOrders();
  });

el("reloadOrders").onclick = () => run(loadOrders);
el("loginTab").onclick = () => showAccount(false);
el("registerTab").onclick = () => showAccount(true);
el("accountButton").onclick = goToAccount;
el("cartButton").onclick = () => {
  if (user) el("cartPanel").scrollIntoView({ block: "start" });
  else {
    goToAccount();
    message("Logga in eller skapa ett konto för att handla.");
  }
};
el("closeEdit").onclick = el("cancelEdit").onclick = () => el("editDialog").close();
el("editProductForm").onsubmit = async (event) => {
  event.preventDefault();
  const button = event.target.querySelector('button[type="submit"], button:not([type])');
  button.disabled = true;
  el("editError").textContent = "";
  try {
    const { name, description, price } = formData(event.target);
    await api(`/api/products/${editingProductId}`, "PUT", { name, description, price: Number(price) });
    el("editDialog").close();
    message("Produkten uppdaterad.");
    await loadProducts();
  } catch (error) {
    if (el("editDialog").open) el("editError").textContent = friendlyError(error);
    else message("Fel: " + friendlyError(error));
  } finally {
    button.disabled = false;
  }
};

drawCart();
run(refreshSession);
