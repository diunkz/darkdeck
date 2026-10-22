// Categorias que continuam nos filtros, mas NÃO aparecem como tag nos cards
export const HIDDEN_CARD_TAGS = [
  "Blister Unitário",
  "Blister Triplo",
  "Blister Quádruplo",
  "Booster Display",
  "Mini BB",
  "ETB"
];

// config.js
export const CONFIG = {
  STORE_NAME: "DARK DECK",
  LOCATION: "Manaus - AM",
  // ID da planilha do Google: docs.google.com/spreadsheets/d/{SHEET_ID}/edit
  SHEET_ID: "15SG0ErqNBD9KhPrWE_B8NEwc93nD04dVpoCY1TCxTa0",
  // Nome exato da aba na planilha
  SHEET_NAME: "Produtos",
  // Contato para pedidos/WhatsApp (opcional para botão direto)
  WHATSAPP_NUMBER: "5592995254107" 
};

// URL pública para exportação em CSV (não precisa de API Key)
export const CSV_URL = `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(CONFIG.SHEET_NAME)}`;