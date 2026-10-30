import { DataService } from "./data-service.js";

class App {
  constructor() {
    this.dataService = new DataService("data/kas-masjid.json");
    this.storageKey = "masjid_custom_profile";
    this.allTransactions = [];
    this.defaultMasjidInfo = {
      nama: "Masjid Al-Ikhlas",
      alamat: "Sleman, Yogyakarta",
      periode: "-"
    };
    this.activeMasjidInfo = { ...this.defaultMasjidInfo };

    this.elements = {
      masjidName: document.getElementById("masjid-name"),
      masjidAddress: document.getElementById("masjid-address"),
      masjidPeriod: document.getElementById("masjid-period"),
      totalMasuk: document.getElementById("total-masuk"),
      totalKeluar: document.getElementById("total-keluar"),
      saldoAkhir: document.getElementById("saldo-akhir"),
      transactionList: document.getElementById("transaction-list"),
      emptyState: document.getElementById("empty-state"),
      searchInput: document.getElementById("search-input"),
      filterType: document.getElementById("filter-type"),
      filterCategory: document.getElementById("filter-category"),
      
      // Modal Elemen
      btnEditMasjid: document.getElementById("btn-edit-masjid"),
      modalEdit: document.getElementById("modal-edit-masjid"),
      formEdit: document.getElementById("form-edit-masjid"),
      inputName: document.getElementById("input-masjid-name"),
      inputAddress: document.getElementById("input-masjid-address"),
      btnCancelModal: document.getElementById("btn-cancel-modal"),
      btnResetDefault: document.getElementById("btn-reset-default")
    };

    this.formatRupiah = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0
    });
  }

  async init() {
    this.bindEvents();
    try {
      const data = await this.dataService.fetchFinancialData();
      this.allTransactions = data.transaksi;
      this.defaultMasjidInfo = data.masjidInfo;

      // Ambil profile custom dari localStorage jika ada, fallback ke data JSON
      this.loadSavedProfile();
      this.renderSummary(this.allTransactions);
      this.applyFilters();
    } catch (error) {
      this.elements.transactionList.innerHTML = `
        <tr>
          <td colspan="6" class="text-center text-danger">
            Terjadi kesalahan saat memuat data: ${this.escapeHTML(error.message)}
          </td>
        </tr>
      `;
    }
  }

  bindEvents() {
    // Filter & Search
    this.elements.searchInput.addEventListener("input", () => this.applyFilters());
    this.elements.filterType.addEventListener("change", () => this.applyFilters());
    this.elements.filterCategory.addEventListener("change", () => this.applyFilters());

    // Interaksi Modal Profil Masjid
    this.elements.btnEditMasjid.addEventListener("click", () => this.openEditModal());
    this.elements.btnCancelModal.addEventListener("click", () => this.elements.modalEdit.close());
    this.elements.formEdit.addEventListener("submit", (e) => this.handleSaveProfile(e));
    this.elements.btnResetDefault.addEventListener("click", () => this.handleResetProfile());
  }

  loadSavedProfile() {
    try {
      const savedData = localStorage.getItem(this.storageKey);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        this.activeMasjidInfo = {
          nama: parsed.nama || this.defaultMasjidInfo.nama,
          alamat: parsed.alamat || this.defaultMasjidInfo.alamat,
          periode: this.defaultMasjidInfo.periode
        };
      } else {
        this.activeMasjidInfo = { ...this.defaultMasjidInfo };
      }
    } catch (e) {
      console.warn("Gagal membaca localStorage, menggunakan data default JSON:", e);
      this.activeMasjidInfo = { ...this.defaultMasjidInfo };
    }

    this.renderHeader(this.activeMasjidInfo);
  }

  openEditModal() {
    this.elements.inputName.value = this.activeMasjidInfo.nama;
    this.elements.inputAddress.value = this.activeMasjidInfo.alamat;
    this.elements.modalEdit.showModal();
  }

  handleSaveProfile(e) {
    e.preventDefault();
    const newName = this.elements.inputName.value.trim();
    const newAddress = this.elements.inputAddress.value.trim();

    if (!newName || !newAddress) return;

    this.activeMasjidInfo.nama = newName;
    this.activeMasjidInfo.alamat = newAddress;

    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        nama: newName,
        alamat: newAddress
      }));
    } catch (e) {
      console.error("Gagal menyimpan ke localStorage:", e);
    }

    this.renderHeader(this.activeMasjidInfo);
    this.elements.modalEdit.close();
  }

  handleResetProfile() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch (e) {
      console.error("Gagal menghapus localStorage:", e);
    }

    this.activeMasjidInfo = { ...this.defaultMasjidInfo };
    this.renderHeader(this.activeMasjidInfo);
    this.elements.modalEdit.close();
  }

  renderHeader(info) {
    this.elements.masjidName.textContent = info.nama;
    this.elements.masjidAddress.textContent = info.alamat;
    this.elements.masjidPeriod.textContent = `Periode: ${info.periode}`;
  }

  renderSummary(transactions) {
    let masuk = 0;
    let keluar = 0;

    for (const tx of transactions) {
      if (tx.tipe === "masuk") {
        masuk += tx.jumlah;
      } else {
        keluar += tx.jumlah;
      }
    }

    const saldo = masuk - keluar;

    this.elements.totalMasuk.textContent = this.formatRupiah.format(masuk);
    this.elements.totalKeluar.textContent = this.formatRupiah.format(keluar);
    this.elements.saldoAkhir.textContent = this.formatRupiah.format(saldo);
  }

  applyFilters() {
    const keyword = this.elements.searchInput.value.trim().toLowerCase();
    const selectedType = this.elements.filterType.value;
    const selectedCategory = this.elements.filterCategory.value;

    const filtered = this.allTransactions.filter(tx => {
      const matchKeyword = tx.deskripsi.toLowerCase().includes(keyword) || 
                           tx.id.toLowerCase().includes(keyword);
      const matchType = selectedType === "all" || tx.tipe === selectedType;
      const matchCategory = selectedCategory === "all" || tx.kategori === selectedCategory;

      return matchKeyword && matchType && matchCategory;
    });

    this.renderTable(filtered);
  }

  renderTable(transactions) {
    const tbody = this.elements.transactionList;
    tbody.innerHTML = "";

    if (transactions.length === 0) {
      this.elements.emptyState.style.display = "block";
      return;
    }

    this.elements.emptyState.style.display = "none";

    const fragment = document.createDocumentFragment();

    transactions.forEach(tx => {
      const row = document.createElement("tr");

      const badgeTypeClass = tx.tipe === "masuk" ? "badge-masuk" : "badge-keluar";
      const typeLabel = tx.tipe === "masuk" ? "Masuk" : "Keluar";

      row.innerHTML = `
        <td><code>${this.escapeHTML(tx.id)}</code></td>
        <td>${this.formatDate(tx.tanggal)}</td>
        <td>${this.escapeHTML(tx.deskripsi)}</td>
        <td><span class="badge badge-category">${this.escapeHTML(tx.kategori)}</span></td>
        <td><span class="badge ${badgeTypeClass}">${typeLabel}</span></td>
        <td class="text-right font-medium">${this.formatRupiah.format(tx.jumlah)}</td>
      `;

      fragment.appendChild(row);
    });

    tbody.appendChild(fragment);
  }

  formatDate(dateString) {
    const options = { day: "numeric", month: "short", year: "numeric" };
    return new Date(dateString).toLocaleDateString("id-ID", options);
  }

  escapeHTML(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  app.init();
});
