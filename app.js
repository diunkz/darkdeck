// app.js
import { CONFIG, CSV_URL, HIDDEN_CARD_TAGS } from "./config.js";

// Normalização de texto (remove acentos e espaços)
function normalizeText(str) {
  if (!str) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Palavras-chave de acessórios
const ACCESSORY_KEYWORDS = [
  "acessorio", "sleeve", "shield", "deck box", 
  "deckbox", "playmat", "toploader", "pasta", "fichario"
];

function isAccessory(itemOrCat) {
  const cat = typeof itemOrCat === "string" ? itemOrCat : (itemOrCat.categoria || "");
  const catNorm = normalizeText(cat);
  return ACCESSORY_KEYWORDS.some(kw => catNorm.includes(kw));
}

// Estado Global - Inicia no modo escuro ('dark') por padrão
const state = {
  products: [],
  filteredProducts: [],
  allGames: [],
  gameCategoriesMap: {},
  accessoryCategories: [], 
  hasPreVenda: false,
  hasDesconto: false,
  hasAcessorios: false,
  searchQuery: "",
  
  activeFilters: {
    categories: [],
    games: [],
    preVenda: false,
    desconto: false
  },

  cart: {},
  theme: localStorage.getItem("darkdeck-theme") || "dark"
};

// Elementos DOM
const dom = {
  html: document.documentElement,
  themeToggle: document.getElementById("themeToggle"),
  searchInput: document.getElementById("searchInput"),
  clearSearchBtn: document.getElementById("clearSearchBtn"),
  desktopNavFilters: document.getElementById("desktopNavFilters"),
  mobileMenuBtn: document.getElementById("mobileMenuBtn"),
  mobileFilterCount: document.getElementById("mobileFilterCount"),
  mobileDrawerOverlay: document.getElementById("mobileDrawerOverlay"),
  closeMobileDrawerBtn: document.getElementById("closeMobileDrawerBtn"),
  mobileDrawerBody: document.getElementById("mobileDrawerBody"),
  productsGrid: document.getElementById("productsGrid"),
  productCount: document.getElementById("productCount"),
  emptyState: document.getElementById("emptyState"),
  floatingCartWrapper: document.getElementById("floatingCartWrapper"),
  floatingCheckoutBtn: document.getElementById("floatingCheckoutBtn"),
  floatingClearCartBtn: document.getElementById("floatingClearCartBtn"),
  drawerClearCartBtn: document.getElementById("drawerClearCartBtn"),
  floatingCartCount: document.getElementById("floatingCartCount"),
  floatingCartTotal: document.getElementById("floatingCartTotal"),
  cartModal: document.getElementById("cartModal"),
  closeCartBtn: document.getElementById("closeCartBtn"),
  cartItemsContainer: document.getElementById("cartItemsContainer"),
  cartTotalPrice: document.getElementById("cartTotalPrice"),
  finishOrderWhatsApp: document.getElementById("finishOrderWhatsApp"),
  imagePreviewModal: document.getElementById("imagePreviewModal"),
  closeImagePreviewBtn: document.getElementById("closeImagePreviewBtn"),
  previewModalImg: document.getElementById("previewModalImg"),
  previewModalTitle: document.getElementById("previewModalTitle"),
  previewModalSubtitle: document.getElementById("previewModalSubtitle")
};

// -------------------------------------------------------------------------
// 1. Gerenciamento de Tema (Padrão Dark)
// -------------------------------------------------------------------------
function initTheme() {
  dom.html.setAttribute("data-theme", state.theme);
  dom.themeToggle.addEventListener("click", () => {
    state.theme = state.theme === "light" ? "dark" : "light";
    dom.html.setAttribute("data-theme", state.theme);
    localStorage.setItem("darkdeck-theme", state.theme);
  });
}

// -------------------------------------------------------------------------
// 2. Parser CSV
// -------------------------------------------------------------------------
function parseCSV(csvText) {
  const rows = [];
  let currentRow = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      currentField += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") i++;
      currentRow.push(currentField.trim());
      if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }

  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.toLowerCase().trim());
  return rows.slice(1).map(row => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index] !== undefined ? row[index] : "";
    });
    return item;
  });
}

// -------------------------------------------------------------------------
// 3. Renderiza Barra de Navegação no Header (Menus Textuais)
// -------------------------------------------------------------------------
function renderDesktopNav() {
  const f = state.activeFilters;
  const isAllActive =
    f.categories.length === 0 &&
    f.games.length === 0 &&
    !f.preVenda &&
    !f.desconto;

  let html = `<button type="button" class="nav-link ${isAllActive ? "active" : ""}" data-action="all">Todos</button>`;

  // 1. Pré-Venda
  if (state.hasPreVenda) {
    const label = f.preVenda ? "Pré-Venda ✕" : "Pré-Venda";
    html += `<button type="button" class="nav-link ${f.preVenda ? "active" : ""}" data-action="pre_venda">${label}</button>`;
  }

  // 2. Com Desconto
  if (state.hasDesconto) {
    const label = f.desconto ? "Com Desconto ✕" : "Com Desconto";
    html += `<button type="button" class="nav-link ${f.desconto ? "active" : ""}" data-action="desconto">${label}</button>`;
  }

  // 3. Jogos com Dropdown Suspenso no Desktop
  state.allGames.forEach(game => {
    const isGameActive = f.games.some(g => normalizeText(g) === normalizeText(game));
    const categories = state.gameCategoriesMap[game] || [];
    
    const activeCatsForGame = categories.filter(c => 
      f.categories.some(activeC => normalizeText(activeC) === normalizeText(c))
    );

    let btnLabel = game;
    if (activeCatsForGame.length === 1) {
      btnLabel = `${game}: ${activeCatsForGame[0]} ✕`;
    } else if (activeCatsForGame.length > 1) {
      btnLabel = `${game} (${activeCatsForGame.length}) ✕`;
    } else if (isGameActive) {
      btnLabel = `${game} ✕`;
    }

    const isHighlight = isGameActive || activeCatsForGame.length > 0;
    const isVerTudoActive = isGameActive && activeCatsForGame.length === 0;

    let dropdownItems = `
      <button type="button" class="dropdown-item ${isVerTudoActive ? "active" : ""}" data-action="select-game-all" data-game="${game}">
        <span>Ver todo o ${game}</span>
      </button>
      <div class="dropdown-divider"></div>
    `;

    categories.forEach(cat => {
      const count = state.products.filter(p => 
        normalizeText(p.jogo) === normalizeText(game) && 
        normalizeText(p.categoria) === normalizeText(cat)
      ).length;
      const isCatActive = f.categories.some(c => normalizeText(c) === normalizeText(cat));

      dropdownItems += `
        <button type="button" class="dropdown-item ${isCatActive ? "active" : ""}" data-action="select-game-cat" data-game="${game}" data-category="${cat}">
          <span>${cat}</span>
          <span class="count-badge">(${count})</span>
        </button>
      `;
    });

    html += `
      <div class="dropdown-wrapper">
        <button type="button" class="nav-link ${isHighlight ? "active" : ""}" data-action="click-game-pill" data-game="${game}">
          <span>${btnLabel}</span>
          <span class="dropdown-arrow">▾</span>
        </button>
        <div class="dropdown-menu">
          ${dropdownItems}
        </div>
      </div>
    `;
  });

  // 4. Acessórios
  if (state.hasAcessorios) {
    const isAccessoryActive = state.accessoryCategories.some(cat => 
      f.categories.some(activeC => normalizeText(activeC) === normalizeText(cat))
    );
    const label = isAccessoryActive ? "Acessórios ✕" : "Acessórios";
    html += `<button type="button" class="nav-link ${isAccessoryActive ? "active" : ""}" data-action="acessorios">${label}</button>`;
  }

  dom.desktopNavFilters.innerHTML = html;
}

// -------------------------------------------------------------------------
// 4. Renderiza Gaveta Lateral Mobile (Com Badge Numérica)
// -------------------------------------------------------------------------
function renderMobileDrawer() {
  const f = state.activeFilters;
  const isAllActive =
    f.categories.length === 0 &&
    f.games.length === 0 &&
    !f.preVenda &&
    !f.desconto;

  let html = `
    <button type="button" class="drawer-link ${isAllActive ? "active" : ""}" data-action="all">
      <span>Todos os Produtos</span>
    </button>
  `;

  if (state.hasPreVenda) {
    html += `
      <button type="button" class="drawer-link ${f.preVenda ? "active" : ""}" data-action="pre_venda">
        <span>Pré-Venda</span>
        ${f.preVenda ? "<span>✕</span>" : ""}
      </button>
    `;
  }

  if (state.hasDesconto) {
    html += `
      <button type="button" class="drawer-link ${f.desconto ? "active" : ""}" data-action="desconto">
        <span>Com Desconto</span>
        ${f.desconto ? "<span>✕</span>" : ""}
      </button>
    `;
  }

  state.allGames.forEach(game => {
    const isGameActive = f.games.some(g => normalizeText(g) === normalizeText(game));
    const categories = state.gameCategoriesMap[game] || [];
    const hasCategoryActive = categories.some(cat => f.categories.some(c => normalizeText(c) === normalizeText(cat)));
    const isVerTudoActive = isGameActive && !hasCategoryActive;

    let subItemsHtml = `
      <button type="button" class="drawer-sub-item ${isVerTudoActive ? "active" : ""}" data-action="select-game-all" data-game="${game}">
        <span>Ver tudo</span>
      </button>
    `;

    categories.forEach(cat => {
      const isCatActive = f.categories.some(c => normalizeText(c) === normalizeText(cat));
      const count = state.products.filter(p => 
        normalizeText(p.jogo) === normalizeText(game) && 
        normalizeText(p.categoria) === normalizeText(cat)
      ).length;

      subItemsHtml += `
        <button type="button" class="drawer-sub-item ${isCatActive ? "active" : ""}" data-action="select-game-cat" data-game="${game}" data-category="${cat}">
          <span>${cat}</span>
          <span class="count-badge">(${count})</span>
        </button>
      `;
    });

    html += `
      <div class="drawer-accordion ${isGameActive || hasCategoryActive ? "open" : ""}">
        <button type="button" class="drawer-accordion-btn" data-action="toggle-accordion">
          <span>${game}</span>
          <span class="dropdown-arrow">▾</span>
        </button>
        <div class="drawer-accordion-content">
          ${subItemsHtml}
        </div>
      </div>
    `;
  });

  if (state.hasAcessorios) {
    const isAccessoryActive = state.accessoryCategories.some(cat => 
      f.categories.some(activeC => normalizeText(activeC) === normalizeText(cat))
    );
    html += `
      <button type="button" class="drawer-link ${isAccessoryActive ? "active" : ""}" data-action="acessorios">
        <span>Acessórios</span>
        ${isAccessoryActive ? "<span>✕</span>" : ""}
      </button>
    `;
  }

  dom.mobileDrawerBody.innerHTML = html;

  const totalActive = f.categories.length + f.games.length + (f.preVenda ? 1 : 0) + (f.desconto ? 1 : 0);
  if (totalActive > 0) {
    dom.mobileFilterCount.style.display = "flex";
    dom.mobileFilterCount.textContent = totalActive;
  } else {
    dom.mobileFilterCount.style.display = "none";
  }
}

// -------------------------------------------------------------------------
// 5. Carregamento dos Produtos
// -------------------------------------------------------------------------
async function fetchProducts() {
  try {
    const response = await fetch(CSV_URL);
    if (!response.ok) throw new Error("Erro na requisição da planilha");

    const csvText = await response.text();
    const rawData = parseCSV(csvText);

    state.products = rawData
      .map((item, index) => {
        const rawPreco = String(item.preco || "0")
          .replace(/[^\d.,]/g, "")
          .replace(/\.(?=.*\.)/g, "")
          .replace(",", ".");
        const precoOriginal = parseFloat(rawPreco) || 0;

        const rawDesconto = String(item.desconto || "")
          .replace(/[^\d.,]/g, "")
          .replace(/\.(?=.*\.)/g, "")
          .replace(",", ".");
        const precoPromocional = rawDesconto !== "" ? parseFloat(rawDesconto) : 0;

        const temDesconto = precoPromocional > 0 && precoPromocional < precoOriginal;
        const precoFinal = temDesconto ? precoPromocional : precoOriginal;

        let porcentagemDesconto = 0;
        if (temDesconto && precoOriginal > 0) {
          porcentagemDesconto = Math.round(((precoOriginal - precoPromocional) / precoOriginal) * 100);
        }

        const isPreVenda = String(item.pre_venda || "").trim().toLowerCase() === "true";
        const nomeClean = (item.nome || "prod").trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
        const uniqueId = item.sku?.trim() ? `sku_${item.sku.trim()}` : `item_${index}_${nomeClean}`;

        const rawCategoria = item.categoria ? item.categoria.trim() : "";
        const rawJogo = item.jogo ? item.jogo.trim() : "";

        return {
          id: uniqueId,
          nome: item.nome ? item.nome.trim() : "",
          descricao: item.descricao ? item.descricao.trim() : "",
          categoria: rawCategoria || (isAccessory(item.nome) ? "Acessórios" : "Geral"),
          jogo: rawJogo,
          colecao: item.colecao ? item.colecao.trim() : "",
          marca: item.marca ? item.marca.trim() : "",
          detalhes: item.detalhes ? item.detalhes.trim() : "",
          precoOriginal: precoOriginal,
          preco: precoFinal,
          descontoPorcentagem: porcentagemDesconto,
          temDesconto: temDesconto,
          quantidade: parseInt(item.quantidade, 10) || 0,
          imagem_url: item.imagem_url ? item.imagem_url.trim() : "https://placehold.co/400x400/0b1116/ff2a42?text=Sem+Foto",
          ativo: String(item.ativo).trim().toLowerCase() === "true",
          idioma: item.idioma ? item.idioma.trim() : "",
          pre_venda: isPreVenda
        };
      })
      .filter(item => item.ativo && item.nome);

    state.hasPreVenda = state.products.some(p => p.pre_venda);
    state.hasDesconto = state.products.some(p => p.temDesconto);
    state.hasAcessorios = state.products.some(p => isAccessory(p.categoria));

    const rawGamesList = state.products.map(p => p.jogo).filter(Boolean).map(j => j.trim());
    state.allGames = [...new Set(rawGamesList)].filter(g => {
      const gNorm = normalizeText(g);
      return gNorm !== "universal" && gNorm !== "outros";
    });

    state.gameCategoriesMap = {};
    state.allGames.forEach(game => {
      const cats = state.products
        .filter(p => normalizeText(p.jogo) === normalizeText(game) && !isAccessory(p.categoria))
        .map(p => p.categoria.trim());
      state.gameCategoriesMap[game] = [...new Set(cats.filter(Boolean))];
    });

    const allCats = [...new Set(state.products.map(p => p.categoria.trim()).filter(Boolean))];
    state.accessoryCategories = allCats.filter(cat => isAccessory(cat));

    renderDesktopNav();
    renderMobileDrawer();
    renderCatalog();
  } catch (error) {
    console.error("Falha ao carregar produtos:", error);
    dom.productsGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 48px 0; color: var(--text-secondary);">
        <p>Não foi possível carregar os produtos no momento.</p>
        <small style="color: var(--text-muted);">Verifique se a planilha está compartilhada publicamente.</small>
      </div>
    `;
    dom.productCount.textContent = "0 itens";
  }
}

// -------------------------------------------------------------------------
// 6. Renderização do Catálogo (Preço Antigo Acima do Atual)
// -------------------------------------------------------------------------
function formatCurrency(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getProductActionHTML(product) {
  const isOutOfStock = product.quantidade <= 0;
  const cartQty = state.cart[product.id]?.quantity || 0;

  if (isOutOfStock) {
    return `
      <button class="btn-add-cart" disabled title="Esgotado">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;
  } else if (cartQty > 0) {
    return `
      <div class="quantity-stepper" data-id="${product.id}">
        <button class="stepper-btn btn-decrease" data-id="${product.id}">−</button>
        <span class="stepper-val">${cartQty}</span>
        <button class="stepper-btn btn-increase" data-id="${product.id}" ${cartQty >= product.quantidade ? "disabled" : ""}>+</button>
      </div>
    `;
  } else {
    return `
      <button class="btn-add-cart btn-init-add" data-id="${product.id}" title="Adicionar ao carrinho">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
      </button>
    `;
  }
}

function updateSingleCardUI(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  const card = document.querySelector(`.product-card[data-id="${productId}"]`);
  if (!card) return;

  const actionsContainer = card.querySelector(".product-actions");
  if (actionsContainer) {
    actionsContainer.innerHTML = getProductActionHTML(product);
  }
}

function renderCatalog() {
  const query = normalizeText(state.searchQuery);
  const f = state.activeFilters;

  const hasStatusFilter = f.preVenda || f.desconto;
  const hasCategoryFilter = f.categories.length > 0;
  const hasGameFilter = f.games.length > 0;

  const matched = state.products.filter(product => {
    const matchesCategory = hasCategoryFilter &&
      f.categories.some(cat => normalizeText(cat) === normalizeText(product.categoria));

    const matchesGame = hasGameFilter &&
      Boolean(product.jogo && f.games.some(game => normalizeText(game) === normalizeText(product.jogo)));

    let matchesStatus = false;
    if (hasStatusFilter) {
      if (f.preVenda && f.desconto) {
        matchesStatus = product.pre_venda || product.temDesconto;
      } else if (f.preVenda) {
        matchesStatus = product.pre_venda;
      } else if (f.desconto) {
        matchesStatus = product.temDesconto;
      }
    }

    let passesFilters = true;
    if (hasStatusFilter && (hasCategoryFilter || hasGameFilter)) {
      passesFilters = matchesStatus || matchesCategory || matchesGame;
    } else if (hasStatusFilter) {
      passesFilters = matchesStatus;
    } else if (hasCategoryFilter || hasGameFilter) {
      passesFilters = (hasCategoryFilter ? matchesCategory : true) && (hasGameFilter ? matchesGame : true);
    }

    if (!passesFilters) return false;

    if (query) {
      const nameNorm = normalizeText(product.nome);
      const colNorm = normalizeText(product.colecao);
      const gameNorm = normalizeText(product.jogo);
      const brandNorm = normalizeText(product.marca);
      const detailsNorm = normalizeText(product.detalhes);

      const matchesSearch =
        nameNorm.includes(query) ||
        colNorm.includes(query) ||
        gameNorm.includes(query) ||
        brandNorm.includes(query) ||
        detailsNorm.includes(query);

      if (!matchesSearch) return false;
    }

    return true;
  });

  state.filteredProducts = matched.sort((a, b) => {
    const aOut = a.quantidade <= 0 ? 1 : 0;
    const bOut = b.quantidade <= 0 ? 1 : 0;
    return aOut - bOut;
  });

  dom.productCount.textContent = `${state.filteredProducts.length} ${state.filteredProducts.length === 1 ? "produto disponível" : "produtos disponíveis"}`;

  if (state.filteredProducts.length === 0) {
    dom.productsGrid.innerHTML = "";
    dom.emptyState.style.display = "block";
    return;
  }

  dom.emptyState.style.display = "none";
  dom.productsGrid.innerHTML = state.filteredProducts.map(product => {
    const isOutOfStock = product.quantidade <= 0;
    
    const highlightBadges = [];
    if (product.pre_venda) highlightBadges.push(`<span class="badge pre-order">PRÉ-VENDA</span>`);
    if (product.temDesconto) highlightBadges.push(`<span class="badge promo">-${product.descontoPorcentagem}%</span>`);

    const highlightBadgeHtml = highlightBadges.length > 0
      ? `<div class="badge-highlight-wrapper">${highlightBadges.join("")}</div>`
      : "";

    const badgeIdioma = product.idioma ? `<span class="badge-tag">${product.idioma.toUpperCase()}</span>` : "";

    const isCategoryBlocked = HIDDEN_CARD_TAGS.some(
      tag => normalizeText(tag) === normalizeText(product.categoria)
    );
    const isRedundant = normalizeText(product.nome).includes(normalizeText(product.categoria));
    const shouldShowCategoryTag = product.categoria && !isCategoryBlocked && !isRedundant;
    const badgeCategoria = shouldShowCategoryTag ? `<span class="badge-tag">${product.categoria}</span>` : "";

    const stockText = isOutOfStock ? "Esgotado" : `${product.quantidade} em estoque`;

    let metaText = "";
    if (product.jogo) {
      metaText = [product.jogo, product.colecao].filter(Boolean).join(" • ");
    } else {
      metaText = [product.marca || "Acessório", product.colecao].filter(Boolean).join(" • ");
    }

    const detalhesHtml = product.detalhes ? `<span class="product-detalhes">${product.detalhes}</span>` : "";

    let priceHtml = "";
    if (product.temDesconto) {
      priceHtml = `
        <div class="product-price-container">
          <span class="product-price-old">${formatCurrency(product.precoOriginal)}</span>
          <span class="product-price promo-price">${formatCurrency(product.preco)}</span>
        </div>
      `;
    } else {
      priceHtml = `
        <div class="product-price-container">
          <span class="product-price">${formatCurrency(product.preco)}</span>
        </div>
      `;
    }

    return `
      <article class="product-card" data-id="${product.id}">
        <div class="product-media js-open-image-preview" data-id="${product.id}">
          ${highlightBadgeHtml}
          <img src="${product.imagem_url}" alt="${product.nome}" loading="lazy" />
          
          <div class="btn-zoom-trigger" title="Ver foto ampliada">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              <line x1="11" y1="8" x2="11" y2="14"></line>
              <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
          </div>
        </div>
        <div class="product-info">
          <div class="product-tags-row">
            ${badgeIdioma}
            ${badgeCategoria}
          </div>

          <span class="product-collection">${metaText}</span>
          <h3 class="product-name">${product.nome}</h3>
          ${detalhesHtml}
          
          <div class="product-footer">
            <div class="product-price-box">
              ${priceHtml}
              <span class="stock-tag ${isOutOfStock ? "out" : ""}">${stockText}</span>
            </div>
            <div class="product-actions">
              ${getProductActionHTML(product)}
            </div>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

// -------------------------------------------------------------------------
// 7. Gerenciamento do Carrinho
// -------------------------------------------------------------------------
function updateCart(id, delta) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;

  const currentQty = state.cart[id]?.quantity || 0;
  const newQty = currentQty + delta;

  if (newQty <= 0) {
    delete state.cart[id];
  } else {
    const validQty = Math.min(newQty, product.quantidade);
    state.cart[id] = { product, quantity: validQty };
  }

  renderCartUI();
  updateSingleCardUI(id);
}

function clearEntireCart() {
  const itemIds = Object.keys(state.cart);
  if (itemIds.length === 0) return;

  state.cart = {};
  renderCartUI();
  itemIds.forEach(id => updateSingleCardUI(id));
}

function renderCartUI() {
  const items = Object.values(state.cart);
  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
  const totalPrice = items.reduce((acc, item) => acc + (item.product.preco * item.quantity), 0);

  if (totalItems > 0) {
    dom.floatingCartWrapper.style.display = "flex";
    dom.floatingCartCount.textContent = totalItems;
    dom.floatingCartTotal.textContent = formatCurrency(totalPrice);
    if (dom.drawerClearCartBtn) dom.drawerClearCartBtn.style.display = "inline-block";
  } else {
    dom.floatingCartWrapper.style.display = "none";
    dom.cartModal.classList.remove("open");
    if (dom.drawerClearCartBtn) dom.drawerClearCartBtn.style.display = "none";
  }

  dom.cartTotalPrice.textContent = formatCurrency(totalPrice);

  if (items.length === 0) {
    dom.cartItemsContainer.innerHTML = `<p style="text-align: center; color: var(--text-muted); margin-top: 40px;">Seu carrinho está vazio.</p>`;
    return;
  }

  dom.cartItemsContainer.innerHTML = items.map(item => {
    const { product, quantity } = item;
    const isMax = quantity >= product.quantidade;
    
    const subInfoText = [product.colecao, product.detalhes].filter(Boolean).join(" • ");
    const subInfoHtml = subInfoText ? `<div class="cart-item-subinfo">${subInfoText}</div>` : "";

    let itemPriceHtml = "";
    if (product.temDesconto) {
      itemPriceHtml = `
        <div class="cart-price-container">
          <span class="cart-price-old">${formatCurrency(product.precoOriginal * quantity)}</span>
          <span class="cart-item-price promo-price">${formatCurrency(product.preco * quantity)}</span>
        </div>
      `;
    } else {
      itemPriceHtml = `
        <div class="cart-price-container">
          <span class="cart-item-price">${formatCurrency(product.preco * quantity)}</span>
        </div>
      `;
    }

    return `
      <div class="cart-item" data-id="${product.id}">
        <img src="${product.imagem_url}" alt="${product.nome}" />
        <div class="cart-item-details">
          <div class="cart-item-name">${product.nome}</div>
          ${subInfoHtml}
          ${itemPriceHtml}
        </div>
        <div class="quantity-stepper">
          <button class="stepper-btn modal-decrease" data-id="${product.id}">−</button>
          <span class="stepper-val">${quantity}</span>
          <button class="stepper-btn modal-increase" data-id="${product.id}" ${isMax ? "disabled" : ""}>+</button>
        </div>
      </div>
    `;
  }).join("");
}

// -------------------------------------------------------------------------
// 8. Envio do Pedido via WhatsApp
// -------------------------------------------------------------------------
function sendOrderToWhatsApp() {
  const items = Object.values(state.cart);
  if (items.length === 0) return;

  const total = items.reduce((acc, item) => acc + (item.product.preco * item.quantity), 0);

  let message = `*NOVO PEDIDO - ${CONFIG.STORE_NAME}*\n`;
  message += `Local: ${CONFIG.LOCATION}\n\n`;
  message += `*Itens Solicitados:*\n`;

  items.forEach(item => {
    const p = item.product;
    const sub = formatCurrency(p.preco * item.quantity);
    
    const preVendaTag = p.pre_venda ? " [PRÉ-VENDA]" : "";
    const promoTag = p.temDesconto ? ` [-${p.descontoPorcentagem}%]` : "";

    const tagIdioma = p.idioma
      ? ` (${p.idioma.charAt(0).toUpperCase() + p.idioma.slice(1).toLowerCase()})`
      : "";

    const extraInfo = p.colecao || p.marca;
    const nomeCompleto = extraInfo ? `${p.nome} ${extraInfo}` : p.nome;

    message += `• ${item.quantity}x ${nomeCompleto}${tagIdioma}${preVendaTag}${promoTag} — ${sub}\n`;
  });

  message += `\n*VALOR TOTAL:* ${formatCurrency(total)}\n\n`;
  message += `Olá! Gostaria de confirmar a disponibilidade e combinar a entrega/retirada em Manaus.`;

  const encodedUrl = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(encodedUrl, "_blank");
}

// -------------------------------------------------------------------------
// 9. Lightbox Preview
// -------------------------------------------------------------------------
function openImagePreview(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;

  dom.previewModalImg.src = product.imagem_url;
  dom.previewModalTitle.textContent = product.nome;

  const sub = [product.jogo || product.marca, product.colecao, product.detalhes].filter(Boolean).join(" • ");
  dom.previewModalSubtitle.textContent = sub;

  dom.imagePreviewModal.classList.add("open");
}

function closeImagePreview() {
  dom.imagePreviewModal.classList.remove("open");
  setTimeout(() => {
    dom.previewModalImg.src = "";
  }, 250);
}

// -------------------------------------------------------------------------
// 10. Centralizador de Filtros
// -------------------------------------------------------------------------
function handleFilterAction(action, btn) {
  if (action === "all") {
    state.activeFilters = { categories: [], games: [], preVenda: false, desconto: false };
  } else if (action === "pre_venda") {
    state.activeFilters.preVenda = !state.activeFilters.preVenda;
  } else if (action === "desconto") {
    state.activeFilters.desconto = !state.activeFilters.desconto;
  } else if (action === "acessorios") {
    const areAccsActive = state.accessoryCategories.some(c => 
      state.activeFilters.categories.some(activeC => normalizeText(activeC) === normalizeText(c))
    );
    if (areAccsActive) {
      state.activeFilters.categories = state.activeFilters.categories.filter(c => !isAccessory(c));
    } else {
      state.activeFilters.categories = [...state.activeFilters.categories, ...state.accessoryCategories];
    }
  } else if (action === "click-game-pill") {
    const game = btn.getAttribute("data-game");
    const catsOfThisGame = state.gameCategoriesMap[game] || [];
    const isGameActive = state.activeFilters.games.some(g => normalizeText(g) === normalizeText(game));
    const hasCategoryActive = catsOfThisGame.some(cat => 
      state.activeFilters.categories.some(c => normalizeText(c) === normalizeText(cat))
    );

    if (isGameActive || hasCategoryActive) {
      state.activeFilters.games = state.activeFilters.games.filter(g => normalizeText(g) !== normalizeText(game));
      state.activeFilters.categories = state.activeFilters.categories.filter(c => 
        !catsOfThisGame.some(cg => normalizeText(cg) === normalizeText(c))
      );
    } else {
      state.activeFilters.games.push(game);
    }
  } else if (action === "select-game-all") {
    const game = btn.getAttribute("data-game");
    const catsOfThisGame = state.gameCategoriesMap[game] || [];

    state.activeFilters.categories = state.activeFilters.categories.filter(c => 
      !catsOfThisGame.some(cg => normalizeText(cg) === normalizeText(c))
    );

    if (!state.activeFilters.games.some(g => normalizeText(g) === normalizeText(game))) {
      state.activeFilters.games.push(game);
    }
  } else if (action === "select-game-cat") {
    const game = btn.getAttribute("data-game");
    const cat = btn.getAttribute("data-category");

    const isCatActive = state.activeFilters.categories.some(c => normalizeText(c) === normalizeText(cat));
    if (isCatActive) {
      state.activeFilters.categories = state.activeFilters.categories.filter(c => normalizeText(c) !== normalizeText(cat));
    } else {
      state.activeFilters.categories = [...state.activeFilters.categories, cat];
      if (!state.activeFilters.games.some(g => normalizeText(g) === normalizeText(game))) {
        state.activeFilters.games.push(game);
      }
    }
  }

  renderDesktopNav();
  renderMobileDrawer();
  renderCatalog();
}

// -------------------------------------------------------------------------
// 11. Listeners & Eventos Globais
// -------------------------------------------------------------------------
function initListeners() {
  dom.searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value;

    if (state.searchQuery.trim().length > 0) {
      dom.clearSearchBtn.style.display = "flex";
      state.activeFilters = { categories: [], games: [], preVenda: false, desconto: false };
      renderDesktopNav();
      renderMobileDrawer();
    } else {
      dom.clearSearchBtn.style.display = "none";
    }

    renderCatalog();
  });

  dom.clearSearchBtn.addEventListener("click", () => {
    dom.searchInput.value = "";
    state.searchQuery = "";
    dom.clearSearchBtn.style.display = "none";
    dom.searchInput.focus();
    renderCatalog();
  });

  dom.desktopNavFilters.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    handleFilterAction(action, btn);
  });

  dom.mobileMenuBtn.addEventListener("click", () => {
    dom.mobileDrawerOverlay.classList.add("open");
  });

  dom.closeMobileDrawerBtn.addEventListener("click", () => {
    dom.mobileDrawerOverlay.classList.remove("open");
  });

  dom.mobileDrawerOverlay.addEventListener("click", (e) => {
    if (e.target === dom.mobileDrawerOverlay) {
      dom.mobileDrawerOverlay.classList.remove("open");
    }
  });

  dom.mobileDrawerBody.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const action = btn.getAttribute("data-action");

    if (action === "toggle-accordion") {
      const accordion = btn.closest(".drawer-accordion");
      if (accordion) accordion.classList.toggle("open");
      return;
    }

    handleFilterAction(action, btn);
    dom.mobileDrawerOverlay.classList.remove("open");
  });

  // Swipe Gesture para Mobile
  let touchStartX = 0;
  let touchStartY = 0;

  window.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener("touchend", (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchEndX - touchStartX;
    const diffY = Math.abs(touchEndY - touchStartY);

    if (touchStartX < 40 && diffX > 60 && diffY < 50) {
      dom.mobileDrawerOverlay.classList.add("open");
    }

    if (dom.mobileDrawerOverlay.classList.contains("open") && diffX < -60 && diffY < 50) {
      dom.mobileDrawerOverlay.classList.remove("open");
    }
  }, { passive: true });

  dom.productsGrid.addEventListener("click", (e) => {
    const mediaContainer = e.target.closest(".js-open-image-preview");
    if (mediaContainer && !e.target.closest(".badge-highlight-wrapper")) {
      const prodId = mediaContainer.getAttribute("data-id");
      openImagePreview(prodId);
      return;
    }

    const initBtn = e.target.closest(".btn-init-add");
    const incBtn = e.target.closest(".btn-increase");
    const decBtn = e.target.closest(".btn-decrease");

    if (initBtn) updateCart(initBtn.getAttribute("data-id"), 1);
    else if (incBtn) updateCart(incBtn.getAttribute("data-id"), 1);
    else if (decBtn) updateCart(decBtn.getAttribute("data-id"), -1);
  });

  dom.closeImagePreviewBtn.addEventListener("click", closeImagePreview);
  dom.imagePreviewModal.addEventListener("click", (e) => {
    if (e.target === dom.imagePreviewModal) closeImagePreview();
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeImagePreview();
      dom.cartModal.classList.remove("open");
      dom.mobileDrawerOverlay.classList.remove("open");
    }
  });

  dom.floatingCheckoutBtn.addEventListener("click", () => dom.cartModal.classList.add("open"));
  dom.closeCartBtn.addEventListener("click", () => dom.cartModal.classList.remove("open"));
  dom.cartModal.addEventListener("click", (e) => {
    if (e.target === dom.cartModal) dom.cartModal.classList.remove("open");
  });

  dom.floatingClearCartBtn.addEventListener("click", clearEntireCart);
  dom.drawerClearCartBtn.addEventListener("click", clearEntireCart);

  dom.cartItemsContainer.addEventListener("click", (e) => {
    const incBtn = e.target.closest(".modal-increase");
    const decBtn = e.target.closest(".modal-decrease");

    if (incBtn) updateCart(incBtn.getAttribute("data-id"), 1);
    if (decBtn) updateCart(decBtn.getAttribute("data-id"), -1);
  });

  dom.finishOrderWhatsApp.addEventListener("click", sendOrderToWhatsApp);
}

// Inicialização
initTheme();
initListeners();
fetchProducts();