const INTRO_TEXT_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmjeZc1HPOvDIkR5UDDcnxY7MHfYnYFJabW4D6dcQDnpDJsJIifa32hX2l43WUL7R6O5JBoISgEnOp/pub?gid=530385584&single=true&output=csv";

const INTRO_SLOT_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmjeZc1HPOvDIkR5UDDcnxY7MHfYnYFJabW4D6dcQDnpDJsJIifa32hX2l43WUL7R6O5JBoISgEnOp/pub?gid=735025845&single=true&output=csv";

async function renderIntroSection(targetSelector = "#introSection") {
  const mount = document.querySelector(targetSelector);
  if (!mount) return;

  mount.innerHTML = `
    <section class="introSection">
      <div class="inner">
        <div class="introCard">
          <div class="introCard__ear introCard__ear--left" aria-hidden="true"></div>
          <div class="introCard__ear introCard__ear--right" aria-hidden="true"></div>

          <div class="introCard__left">
            <div class="introLoading">인트로 정보를 불러오는 중입니다...</div>
          </div>

          <div class="introCard__right">
            <div class="introLoading">슬롯 정보를 불러오는 중입니다...</div>
          </div>
        </div>
      </div>
    </section>
  `;

  const leftEl = mount.querySelector(".introCard__left");
  const rightEl = mount.querySelector(".introCard__right");

  try {
    const [textRows, slotRows] = await Promise.all([
      fetchCsvRows(INTRO_TEXT_CSV),
      fetchCsvRows(INTRO_SLOT_CSV)
    ]);

    const introText = getIntroText(textRows);
    const slotData = normalizeSlotRows(slotRows);

    leftEl.innerHTML = buildIntroTextHtml(introText);
    rightEl.innerHTML = buildSlotPanelHtml(slotData);
  } catch (error) {
    console.error("[renderIntroSection] error:", error);

    leftEl.innerHTML = `
      <div class="introError">
        소개 문구를 불러오지 못했습니다.
      </div>
    `;

    rightEl.innerHTML = `
      <div class="introError">
        슬롯 정보를 불러오지 못했습니다.
      </div>
    `;
  }
}

async function fetchCsvRows(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`CSV fetch failed: ${res.status} ${res.statusText}`);
  }
  const csvText = await res.text();
  return parseCsv(csvText);
}

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  while (i < csv.length) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i += 1;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      field = "";

      const hasAnyValue = row.some(cell => String(cell).trim() !== "");
      if (hasAnyValue) rows.push(row);

      row = [];
      i += 1;
      continue;
    }

    field += char;
    i += 1;
  }

  if (field.length || row.length) {
    row.push(field);
    const hasAnyValue = row.some(cell => String(cell).trim() !== "");
    if (hasAnyValue) rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map(v => String(v).trim());
  return rows.slice(1).map(cols => {
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = (cols[idx] ?? "").trim();
    });
    return obj;
  });
}

function getIntroText(rows) {
  if (!Array.isArray(rows) || !rows.length) return "";
  return rows[0]?.text?.trim() || "";
}

function normalizeSlotRows(rows) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map(row => ({
      month: row.month?.trim() || "",
      slots: [
        normalizeSlotValue(row["slot 1"]),
        normalizeSlotValue(row["slot 2"]),
        normalizeSlotValue(row["slot 3"])
      ]
    }))
    .filter(row => row.month);
}

function normalizeSlotValue(value) {
  const raw = String(value || "").trim().toLowerCase();

  if (raw === "open") {
    return { state: "open", label: "OPEN", mark: "○" };
  }

  if (raw === "closed") {
    return { state: "closed", label: "CLOSED", mark: "●" };
  }

  return {
    state: "unknown",
    label: raw ? raw.toUpperCase() : "-",
    mark: "–"
  };
}

function buildIntroTextHtml(text) {
  const safeText = escapeHtml(text || "");

  return `
    <div class="introBadge">Illustrator · Live2D</div>
    <div class="introTextBox">
      <p class="introText">${safeText}</p>
    </div>
  `;
}

function buildSlotPanelHtml(rows) {
  const rowHtml = rows.map(buildSlotRowHtml).join("");

  return `
    <aside class="slotPanel">
      <div class="slotPanel__head">
        <h3 class="slotPanel__title">작업 슬롯 현황</h3>
        <div class="slotPanel__legend">
          <span class="slotLegend">
            <span class="slotLegend__mark">●</span>
            CLOSED
          </span>
          <span class="slotLegend">
            <span class="slotLegend__mark">○</span>
            OPEN
          </span>
        </div>
      </div>

      <div class="slotGrid">
        ${rowHtml}
      </div>
    </aside>
  `;
}

function buildSlotRowHtml(row) {
  const cells = row.slots
    .map(slot => {
      return `
        <div class="slotCell is-${slot.state}">
          <span class="slotCell__mark">${escapeHtml(slot.mark)}</span>
          <span class="slotCell__label">${escapeHtml(slot.label)}</span>
        </div>
      `;
    })
    .join("");

  return `
    <div class="slotRow">
      <div class="slotMonth">${escapeHtml(row.month)}</div>
      ${cells}
    </div>
  `;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

document.addEventListener("DOMContentLoaded", () => {
  renderIntroSection("#introSection");
});


/* ==============================
   Notice Section Renderer
============================== */

const NOTICE_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmjeZc1HPOvDIkR5UDDcnxY7MHfYnYFJabW4D6dcQDnpDJsJIifa32hX2l43WUL7R6O5JBoISgEnOp/pub?gid=0&single=true&output=csv";

async function renderNoticeSection(targetSelector = "#noticeSection") {
  const mount = document.querySelector(targetSelector);
  if (!mount) return;

  mount.innerHTML = `
    <section class="noticeSection">
      <div class="inner">
        <div class="noticeWrap">
          <div class="noticeEar noticeEar--left" aria-hidden="true"></div>
          <div class="noticeEar noticeEar--right" aria-hidden="true"></div>
          <div class="noticeBgX" aria-hidden="true"></div>

          <div class="noticeContent">
            <div class="noticeLoading">공지사항을 불러오는 중입니다...</div>
          </div>
        </div>
      </div>
    </section>
  `;

  const contentEl = mount.querySelector(".noticeContent");
  if (!contentEl) return;

  try {
    const rows = await fetchCsvRows(NOTICE_CSV_URL);
    const grouped = groupNoticeRows(rows);

    contentEl.innerHTML = buildNoticeSectionHtml(grouped);
  } catch (error) {
    console.error("[renderNoticeSection] error:", error);

    contentEl.innerHTML = `
      <div class="noticeError">
        공지사항을 불러오지 못했습니다.
      </div>
    `;
  }
}

/* ------------------------------
   CSV
------------------------------ */
async function fetchCsvRows(url) {
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`CSV fetch failed: ${res.status} ${res.statusText}`);
  }

  const csvText = await res.text();
  return parseCsv(csvText);
}

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  while (i < csv.length) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 2;
        continue;
      }

      inQuotes = !inQuotes;
      i += 1;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;

      row.push(field);
      field = "";

      const hasAnyValue = row.some((cell) => String(cell).trim() !== "");
      if (hasAnyValue) rows.push(row);

      row = [];
      i += 1;
      continue;
    }

    field += char;
    i += 1;
  }

  if (field.length || row.length) {
    row.push(field);

    const hasAnyValue = row.some((cell) => String(cell).trim() !== "");
    if (hasAnyValue) rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map((v) => String(v).trim());

  return rows.slice(1).map((cols) => {
    const obj = {};

    headers.forEach((header, idx) => {
      obj[header] = (cols[idx] ?? "").trim();
    });

    return obj;
  });
}

/* ------------------------------
   Normalize
------------------------------ */
function groupNoticeRows(rows) {
  const map = new Map();

  rows.forEach((row) => {
    const group = String(row.group || "").trim();
    const orderRaw = String(row.order || "").trim();
    const order = Number(orderRaw);
    const desc = String(row.desc || "").trim();

    if (!group || !desc) return;

    if (!map.has(group)) {
      map.set(group, []);
    }

    map.get(group).push({
      order: Number.isFinite(order) ? order : 999,
      desc
    });
  });

  return Array.from(map.entries()).map(([group, items]) => {
    items.sort((a, b) => a.order - b.order);
    return { group, items };
  });
}

/* ------------------------------
   HTML builders
------------------------------ */
function buildNoticeSectionHtml(groups) {
  const cardsHtml = groups.map(buildNoticeCardHtml).join("");

  return `
    <div class="noticeHeader">
      <div class="noticeBadge">Notice Guide</div>

      <div class="noticeTitleRow">
        <div class="noticeTitleBox">
          <h2 class="noticeTitle">작업 공지사항</h2>
          <p class="noticeLead">
            <strong>※</strong> 본 공지를 숙지하지 않아 발생하는 모든 문제에 대해 작가는 책임지지 않습니다.
          </p>
        </div>
      </div>
    </div>

    <div class="noticeGroupGrid">
      ${cardsHtml}
    </div>
  `;
}

function buildNoticeCardHtml(groupData) {
  const itemsHtml = groupData.items
    .map((item, idx) => {
      return `
        <li class="noticeItem">
          <span class="noticeItem__num">${idx + 1}</span>
          <div class="noticeItem__text">${escapeHtml(item.desc)}</div>
        </li>
      `;
    })
    .join("");

  return `
    <article class="noticeCard">
      <div class="noticeCard__head">
        <span class="noticeCard__bullet" aria-hidden="true">♡</span>
        <h3 class="noticeCard__title">${escapeHtml(groupData.group)}</h3>
      </div>

      <ul class="noticeList">
        ${itemsHtml}
      </ul>
    </article>
  `;
}

/* ------------------------------
   Utils
------------------------------ */
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/* ------------------------------
   Init
------------------------------ */
document.addEventListener("DOMContentLoaded", () => {
  renderNoticeSection("#noticeSection");
});



/* ==============================
   Collab Section Renderer
============================== */

const COLLAB_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmjeZc1HPOvDIkR5UDDcnxY7MHfYnYFJabW4D6dcQDnpDJsJIifa32hX2l43WUL7R6O5JBoISgEnOp/pub?gid=1854392720&single=true&output=csv";

async function renderCollabSection(targetSelector = "#collabSection") {
  const mount = document.querySelector(targetSelector);
  if (!mount) return;

  mount.innerHTML = `
    <section class="collabSection">
      <div class="inner">
        <div class="collabWrap">
          <div class="collabEar collabEar--left" aria-hidden="true"></div>
          <div class="collabEar collabEar--right" aria-hidden="true"></div>

          <div class="collabContent">
            <div class="collabLoading">협업 작가 정보를 불러오는 중입니다...</div>
          </div>
        </div>
      </div>
    </section>
  `;

  const contentEl = mount.querySelector(".collabContent");
  if (!contentEl) return;

  try {
    const rows = await fetchCollabCsvRows(COLLAB_CSV_URL);
    const items = normalizeCollabRows(rows);
    const filledItems = fillCollabSlots(items, 3);

    contentEl.innerHTML = buildCollabSectionHtml(filledItems);
  } catch (error) {
    console.error("[renderCollabSection] error:", error);

    contentEl.innerHTML = `
      <div class="collabError">
        협업 작가 정보를 불러오지 못했습니다.
      </div>
    `;
  }
}

async function fetchCollabCsvRows(url) {
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`CSV fetch failed: ${res.status} ${res.statusText}`);
  }

  const csvText = await res.text();
  return parseCollabCsv(csvText);
}

function parseCollabCsv(csv) {
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  while (i < csv.length) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 2;
        continue;
      }

      inQuotes = !inQuotes;
      i += 1;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;

      row.push(field);
      field = "";

      const hasAnyValue = row.some((cell) => String(cell).trim() !== "");
      if (hasAnyValue) rows.push(row);

      row = [];
      i += 1;
      continue;
    }

    field += char;
    i += 1;
  }

  if (field.length || row.length) {
    row.push(field);

    const hasAnyValue = row.some((cell) => String(cell).trim() !== "");
    if (hasAnyValue) rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map((v) => String(v).trim());

  return rows.slice(1).map((cols) => {
    const obj = {};

    headers.forEach((header, idx) => {
      obj[header] = (cols[idx] ?? "").trim();
    });

    return obj;
  });
}

function normalizeCollabRows(rows) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      const order = Number(String(row.order || "").trim());

      return {
        order: Number.isFinite(order) ? order : 999,
        name: String(row.name || "").trim(),
        desc: String(row.desc || "").trim(),
        link: String(row.link || "").trim(),
        price: String(row.price || "").trim(),
        isPlaceholder: false
      };
    })
    .filter((item) => item.name)
    .sort((a, b) => a.order - b.order);
}

function fillCollabSlots(items, totalSlots = 3) {
  const list = Array.isArray(items) ? [...items] : [];

  while (list.length < totalSlots) {
    list.push({
      order: list.length + 1,
      name: "협업 준비중입니다",
      desc: "새로운 작가님과 협업을 준비중이에요!",
      link: "",
      price: "",
      isPlaceholder: true
    });
  }

  return list.slice(0, totalSlots);
}

function buildCollabSectionHtml(items) {
  const cardsHtml = items.map(buildCollabCardHtml).join("");

  return `
    <div class="collabHeader">
      <div class="collabBadge">Collaboration Artist</div>

      <div class="collabTitleBox">
        <h2 class="collabTitle">협업 작가</h2>
        <p class="collabLead">
          함께 진행 가능한 협업 작가님들을 안내드립니다.
        </p>
      </div>
    </div>

    <div class="collabGrid">
      ${cardsHtml}
    </div>
  `;
}

function buildCollabCardHtml(item) {
  if (item.isPlaceholder) {
    return `
      <article class="collabCard is-placeholder">
        <div class="collabCard__x collabCard__x--top" aria-hidden="true"></div>
        <div class="collabCard__x collabCard__x--bottom" aria-hidden="true"></div>

        <div class="collabCard__inner">
          <div class="collabCard__head">
            <span class="collabCard__status">Coming Soon</span>
            <h3 class="collabCard__name">${escapeCollabHtml(item.name)}</h3>
          </div>

          <p class="collabCard__desc">${escapeCollabHtml(item.desc)}</p>
        </div>
      </article>
    `;
  }

  return `
    <article class="collabCard">
      <div class="collabCard__x collabCard__x--top" aria-hidden="true"></div>
      <div class="collabCard__x collabCard__x--bottom" aria-hidden="true"></div>

      <div class="collabCard__inner">
        <div class="collabCard__head">
          <span class="collabCard__order">COLLAB ${escapeCollabHtml(item.order)}</span>
          <h3 class="collabCard__name">${escapeCollabHtml(item.name)}</h3>
        </div>

        <p class="collabCard__desc">${escapeCollabHtml(item.desc)}</p>

        <div class="collabCard__footer">
          <a
            class="collabCard__link"
            href="${escapeCollabAttr(item.link)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            아트머그로 이동
          </a>
        </div>
      </div>
    </article>
  `;
}

function escapeCollabHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeCollabAttr(str) {
  return escapeCollabHtml(str);
}

document.addEventListener("DOMContentLoaded", () => {
  renderCollabSection("#collabSection");
});



/* ==============================
   Sample Section Renderer
============================== */

const SAMPLE_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmjeZc1HPOvDIkR5UDDcnxY7MHfYnYFJabW4D6dcQDnpDJsJIifa32hX2l43WUL7R6O5JBoISgEnOp/pub?gid=342370995&single=true&output=csv";

async function renderSampleSection(targetSelector = "#sampleSection") {
  const mount = document.querySelector(targetSelector);
  if (!mount) return;

  mount.innerHTML = `
    <section class="sampleSection">
      <div class="inner">
        <div class="sampleWrap">
          <div class="sampleEar sampleEar--left" aria-hidden="true"></div>
          <div class="sampleEar sampleEar--right" aria-hidden="true"></div>

          <div class="sampleContent">
            <div class="sampleLoading">샘플 이미지를 불러오는 중입니다...</div>
          </div>
        </div>
      </div>
    </section>
  `;

  const contentEl = mount.querySelector(".sampleContent");
  if (!contentEl) return;

  try {
    const rows = await fetchSampleCsvRows(SAMPLE_CSV_URL);
    const items = normalizeSampleRows(rows);
    const groups = groupSampleItems(items);

    if (!groups.length) {
      contentEl.innerHTML = `
        <div class="sampleEmpty">등록된 샘플이 없습니다.</div>
      `;
      return;
    }

    contentEl.innerHTML = buildSampleSectionHtml(groups);
  } catch (error) {
    console.error("[renderSampleSection] error:", error);

    contentEl.innerHTML = `
      <div class="sampleError">샘플 이미지를 불러오지 못했습니다.</div>
    `;
  }
}

async function fetchSampleCsvRows(url) {
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`CSV fetch failed: ${res.status} ${res.statusText}`);
  }

  const csvText = await res.text();
  return parseSampleCsv(csvText);
}

function parseSampleCsv(csv) {
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  while (i < csv.length) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 2;
        continue;
      }

      inQuotes = !inQuotes;
      i += 1;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;

      row.push(field);
      field = "";

      const hasAnyValue = row.some((cell) => String(cell).trim() !== "");
      if (hasAnyValue) rows.push(row);

      row = [];
      i += 1;
      continue;
    }

    field += char;
    i += 1;
  }

  if (field.length || row.length) {
    row.push(field);

    const hasAnyValue = row.some((cell) => String(cell).trim() !== "");
    if (hasAnyValue) rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map((v) => String(v).trim());

  return rows.slice(1).map((cols) => {
    const obj = {};

    headers.forEach((header, idx) => {
      obj[header] = (cols[idx] ?? "").trim();
    });

    return obj;
  });
}

function normalizeSampleRows(rows) {
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      const order = Number(String(row.order || "").trim());

      return {
        group: String(row.group || "").trim(),
        order: Number.isFinite(order) ? order : 999,
        title: String(row.title || "").trim(),
        desc: String(row.desc || "").trim(),
        imageUrl: convertDriveUrlToDirect(String(row.image_url || "").trim())
      };
    })
    .filter((item) => item.group && item.imageUrl)
    .sort((a, b) => a.order - b.order);
}

function groupSampleItems(items) {
  const map = new Map();

  items.forEach((item) => {
    if (!map.has(item.group)) {
      map.set(item.group, []);
    }
    map.get(item.group).push(item);
  });

  return Array.from(map.entries()).map(([groupName, groupItems]) => ({
    name: groupName,
    items: [...groupItems].sort((a, b) => a.order - b.order)
  }));
}

function buildSampleSectionHtml(groups) {
  return `
    <div class="sampleHeader">
      <div class="sampleBadge">Sample Preview</div>

      <div class="sampleTitleBox">
        <h2 class="sampleTitle">샘플</h2>
        <p class="sampleLead">
          작업 예시를 클릭하면 새 창에서 크게 확인하실 수 있습니다.
        </p>
      </div>
    </div>

    <div class="sampleGroups">
      ${groups.map(buildSampleGroupHtml).join("")}
    </div>
  `;
}

function buildSampleGroupHtml(group) {
  return `
    <section class="sampleGroup">
      <div class="sampleGroup__head">
        <h3 class="sampleGroup__title">${escapeSampleHtml(group.name)}</h3>
        <span class="sampleGroup__count">${group.items.length} SAMPLE</span>
      </div>

      <div class="sampleGrid">
        ${group.items.map(buildSampleCardHtml).join("")}
      </div>
    </section>
  `;
}

function buildSampleCardHtml(item) {
  const safeTitle = escapeSampleHtml(item.title);
  const safeDesc = escapeSampleHtml(item.desc);
  const safeHref = escapeSampleAttr(item.imageUrl);

  return `
    <a
      class="sampleCard"
      href="${safeHref}"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="${safeTitle} 새 창에서 크게 보기"
    >
      <div class="sampleCard__thumb">
        <img
          src="${safeHref}"
          alt="${safeTitle}"
          loading="lazy"
          referrerpolicy="no-referrer"
        />
        <span class="sampleCard__zoom">VIEW</span>
      </div>

      <div class="sampleCard__body">
        <div class="sampleCard__top">
          <span class="sampleCard__order">NO.${escapeSampleHtml(item.order)}</span>
        </div>

        <h4 class="sampleCard__title">${safeTitle}</h4>
        <p class="sampleCard__desc">${safeDesc}</p>
      </div>
    </a>
  `;
}

function convertDriveUrlToDirect(url) {
  const value = String(url || "").trim();
  if (!value) return "";

  const fileMatch = value.match(/\/file\/d\/([^/]+)/);
  if (fileMatch?.[1]) {
    return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;
  }

  const idMatch = value.match(/[?&]id=([^&]+)/);
  if (idMatch?.[1]) {
    return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
  }

  return value;
}

function escapeSampleHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeSampleAttr(str) {
  return escapeSampleHtml(str);
}

document.addEventListener("DOMContentLoaded", () => {
  renderSampleSection("#sampleSection");
});





/* ==============================
   Form Section Renderer
============================== */

const FORM_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmjeZc1HPOvDIkR5UDDcnxY7MHfYnYFJabW4D6dcQDnpDJsJIifa32hX2l43WUL7R6O5JBoISgEnOp/pub?gid=1580835135&single=true&output=csv";

const COLLAB_DISCOUNT_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmjeZc1HPOvDIkR5UDDcnxY7MHfYnYFJabW4D6dcQDnpDJsJIifa32hX2l43WUL7R6O5JBoISgEnOp/pub?gid=1854392720&single=true&output=csv";

async function renderFormSection(targetSelector = "#formSection") {
  const mount = document.querySelector(targetSelector);
  if (!mount) return;

  mount.innerHTML = `
    <section class="formSection">
      <div class="inner">
        <div class="formWrap">
          <div class="formEar formEar--left" aria-hidden="true"></div>
          <div class="formEar formEar--right" aria-hidden="true"></div>

          <div class="formContent">
            <div class="formLoading">신청 양식과 견적 옵션을 불러오는 중입니다...</div>
          </div>
        </div>
      </div>
    </section>
  `;

  const contentEl = mount.querySelector(".formContent");
  if (!contentEl) return;

  try {
    const [formRows, collabRows] = await Promise.all([
      fetchFormCsvRows(FORM_CSV_URL),
      fetchFormCsvRows(COLLAB_DISCOUNT_CSV_URL)
    ]);

    const pricingData = normalizeFormPricingRows(formRows);
    const collabData = normalizeCollabDiscountRows(collabRows);

    contentEl.innerHTML = buildFormSectionHtml(pricingData, collabData);
    setupFormCalculator(mount, pricingData, collabData);
  } catch (error) {
    console.error("[renderFormSection] error:", error);

    contentEl.innerHTML = `
      <div class="formError">
        신청 양식 정보를 불러오지 못했습니다.
      </div>
    `;
  }
}

async function fetchFormCsvRows(url) {
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`CSV fetch failed: ${res.status} ${res.statusText}`);
  }

  const csvText = await res.text();
  return parseUniversalCsv(csvText);
}

function parseUniversalCsv(csv) {
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  while (i < csv.length) {
    const char = csv[i];
    const next = csv[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i += 1;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      i += 1;
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;

      row.push(field);
      field = "";

      const hasAnyValue = row.some((cell) => String(cell).trim() !== "");
      if (hasAnyValue) rows.push(row);

      row = [];
      i += 1;
      continue;
    }

    field += char;
    i += 1;
  }

  if (field.length || row.length) {
    row.push(field);
    const hasAnyValue = row.some((cell) => String(cell).trim() !== "");
    if (hasAnyValue) rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map((v) => String(v).trim());

  return rows.slice(1).map((cols) => {
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = String(cols[idx] ?? "").trim();
    });
    return obj;
  });
}

function normalizeFormPricingRows(rows) {
  const list = Array.isArray(rows) ? rows : [];

  return list
    .map((row) => {
      const order = Number(row.order || 999);
      const price = parsePrice(row.price);

      return {
        group: String(row.group || "").trim(),
        order: Number.isFinite(order) ? order : 999,
        title: String(row.title || "").trim(),
        desc: String(row.desc || "").trim(),
        calcType: String(row.calc_type || "add").trim().toLowerCase(),
        price
      };
    })
    .filter((item) => item.group && item.title)
    .sort((a, b) => {
      if (a.group === b.group) return a.order - b.order;
      return a.group.localeCompare(b.group, "ko");
    });
}

function normalizeCollabDiscountRows(rows) {
  const list = Array.isArray(rows) ? rows : [];

  return list
    .map((row) => {
      const order = Number(row.order || 999);
      const price = parsePrice(row.price);

      return {
        order: Number.isFinite(order) ? order : 999,
        name: String(row.name || "").trim(),
        desc: String(row.desc || "").trim(),
        link: String(row.link || "").trim(),
        price
      };
    })
    .filter((item) => item.name)
    .sort((a, b) => a.order - b.order);
}

function parsePrice(value) {
  const normalized = String(value ?? "")
    .replace(/[^\d.-]/g, "")
    .trim();

  if (!normalized) return 0;

  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

function buildFormSectionHtml(pricingData, collabData) {
  const baseOptions = pricingData.filter((item) => item.group === "기본 옵션");
  const extraOptions = pricingData.filter((item) => item.group === "추가 옵션");

  return `
    <div class="formHeader">
      <div class="formBadge">Application Form</div>
      <h2 class="formTitle">신청 양식</h2>
      <p class="formLead">
        기본 옵션과 추가 옵션을 선택하면 예상 금액이 자동으로 계산됩니다.
      </p>
    </div>

    <div class="formLayout">
      <div class="formPanel">
        <div class="formBlock">
          <div class="formBlock__head">
            <span class="formBlock__badge">STEP 1</span>
            <h3 class="formBlock__title">일러스트 옵션</h3>
          </div>
          <div class="formDivider"></div>

          <div class="baseOptionGrid">
            ${baseOptions.map((item, index) => buildBaseOptionHtml(item, index)).join("")}
          </div>
        </div>

        <div class="formBlock">
          <div class="formBlock__head">
            <span class="formBlock__badge">STEP 2</span>
            <h3 class="formBlock__title">신청 정보</h3>
          </div>
          <div class="formDivider"></div>

          <div class="formFieldGrid">
            <label class="formField">
              <span class="formLabel">방송닉네임</span>
              <input class="formInput" type="text" name="nickname" placeholder="예: 슈라">
            </label>

            <label class="formField">
              <span class="formLabel">방송플랫폼</span>
              <input class="formInput" type="text" name="platform" placeholder="예: YouTube / Twitch / Chzzk">
            </label>

            <label class="formField">
              <span class="formLabel">포트폴리오 공개일</span>
              <input class="formInput" type="text" name="portfolioOpenDate" placeholder="예: 2026-03-20">
            </label>

            <label class="formField">
              <span class="formLabel">희망 마감일 / 데뷔 예정일</span>
              <input class="formInput" type="text" name="deadline" placeholder="예: 2026-05-30">
            </label>

            <label class="formField is-full">
              <span class="formLabel">리거 아트머그 링크</span>
              <input class="formInput" type="url" name="riggerLink" placeholder="https://artmug.kr/...">
            </label>

            <label class="formField">
              <span class="formLabel">작업과정 SNS 공개</span>
              <select class="formSelect" name="snsOpen">
                <option value="">선택해주세요</option>
                <option value="가능">가능</option>
                <option value="불가능">불가능</option>
                <option value="일부 가능">일부 가능</option>
              </select>
            </label>

            <label class="formField">
              <span class="formLabel">협업작가님 유무</span>
              <select class="formSelect js-collab-select" name="collabArtist">
                <option value="">없음</option>
                ${collabData.map(buildCollabOptionHtml).join("")}
              </select>
            </label>

            <label class="formField is-full">
              <span class="formLabel">추가 요청사항</span>
              <textarea class="formTextarea" name="extraRequest" placeholder="요청사항을 자유롭게 작성해주세요."></textarea>
            </label>
          </div>
        </div>

        <div class="formBlock">
          <div class="formBlock__head">
            <span class="formBlock__badge">STEP 3</span>
            <h3 class="formBlock__title">추가 옵션</h3>
          </div>
          <div class="formDivider"></div>

          <div class="optionList">
            ${extraOptions.map((item, index) => buildExtraOptionHtml(item, index)).join("")}
          </div>
        </div>
      </div>

      <aside class="formCalc">
        <h3 class="calcTitle">예상 금액</h3>
        <p class="calcInfo">
          선택한 항목 기준의 참고용 계산 결과입니다.<br>
          최종 금액은 작업 내용에 따라 달라질 수 있습니다.
        </p>

        <div class="calcSummary">
          <div class="calcLine">
            <div class="calcLine__label">기본 옵션</div>
            <div class="calcLine__value js-base-summary">선택되지 않음</div>
          </div>

          <div class="calcLine">
            <div class="calcLine__label">추가 옵션 합계</div>
            <div class="calcLine__value js-extra-summary">0원</div>
          </div>

          <div class="calcLine is-discount">
            <div class="calcLine__label">협업 할인</div>
            <div class="calcLine__value js-discount-summary">0원</div>
          </div>
        </div>

        <div class="calcTotal">
          <div class="calcTotal__top">
            <span class="calcTotal__label">총 예상 금액</span>
            <strong class="calcTotal__value js-total-price">0원</strong>
          </div>
          <p class="calcNote">
            협업 작가를 선택하면 해당 할인 금액이 자동 반영됩니다.
          </p>
        </div>

        <div class="calcActions">
          <button type="button" class="calcBtn js-copy-estimate">견적 내용 복사</button>
          <button type="button" class="calcBtn js-reset-form">선택 초기화</button>
        </div>
      </aside>
    </div>
  `;
}

function buildBaseOptionHtml(item, index) {
  const id = `baseOption_${index + 1}`;

  return `
    <label class="baseOption">
      <input
        type="radio"
        name="baseOption"
        value="${escapeFormAttr(item.title)}"
        data-price="${item.price}"
        data-title="${escapeFormAttr(item.title)}"
        ${index === 0 ? "checked" : ""}
      >
      <span class="baseOption__label">
        <span class="baseOption__top">
          <span class="baseOption__chip">BASE ${index + 1}</span>
          <span class="baseOption__price">${formatPrice(item.price)}</span>
        </span>
        <strong class="baseOption__title">${escapeFormHtml(item.title)}</strong>
        <p class="baseOption__desc">${escapeFormHtml(item.desc)}</p>
      </span>
    </label>
  `;
}

function buildExtraOptionHtml(item, index) {
  const checkboxId = `extraOption_${index + 1}`;
  const hasPrice = item.price > 0;
  const isUnit = item.calcType === "unit";

  return `
    <div class="optionItem">
      <div class="optionItem__row">
        <input
          id="${checkboxId}"
          type="checkbox"
          class="js-extra-check"
          data-title="${escapeFormAttr(item.title)}"
          data-desc="${escapeFormAttr(item.desc)}"
          data-price="${item.price}"
          data-calc-type="${escapeFormAttr(item.calcType)}"
        >

        <div class="optionItem__main">
          <label class="optionItem__title" for="${checkboxId}">
            ${escapeFormHtml(item.title)}
          </label>
          <div class="optionItem__desc">
            ${escapeFormHtml(item.desc || "추가 선택 항목")}
          </div>
        </div>

        <div class="optionItem__meta">
          <span class="optionItem__price">
            ${isUnit ? "개당 " : ""}${hasPrice ? formatPriceShort(item.price) : "문의"}
          </span>

          ${
            isUnit
              ? `
                <input
                  type="number"
                  class="optionQty js-option-qty"
                  min="1"
                  step="1"
                  value="1"
                  disabled
                  aria-label="${escapeFormAttr(item.title)} 수량"
                >
              `
              : ``
          }
        </div>
      </div>
    </div>
  `;
}

function buildCollabOptionHtml(item) {
  return `
    <option
      value="${escapeFormAttr(item.name)}"
      data-discount="${item.price}"
    >
      ${escapeFormHtml(item.name)} (${item.price > 0 ? `${formatPrice(item.price)} 할인` : "할인 없음"})
    </option>
  `;
}

function setupFormCalculator(root, pricingData, collabData) {
  const baseInputs = root.querySelectorAll('input[name="baseOption"]');
  const extraChecks = root.querySelectorAll(".js-extra-check");
  const collabSelect = root.querySelector(".js-collab-select");

  const baseSummaryEl = root.querySelector(".js-base-summary");
  const extraSummaryEl = root.querySelector(".js-extra-summary");
  const discountSummaryEl = root.querySelector(".js-discount-summary");
  const totalPriceEl = root.querySelector(".js-total-price");

  const copyBtn = root.querySelector(".js-copy-estimate");
  const resetBtn = root.querySelector(".js-reset-form");

  function updateQtyState() {
    extraChecks.forEach((check) => {
      const optionItem = check.closest(".optionItem");
      const qtyInput = optionItem?.querySelector(".js-option-qty");
      if (!qtyInput) return;

      qtyInput.disabled = !check.checked;
      if (!check.checked) qtyInput.value = 1;
    });
  }

  function calculate() {
    let baseTitle = "선택되지 않음";
    let basePrice = 0;

    const selectedBase = root.querySelector('input[name="baseOption"]:checked');
    if (selectedBase) {
      baseTitle = selectedBase.dataset.title || "기본 옵션";
      basePrice = Number(selectedBase.dataset.price || 0);
    }

    let extraTotal = 0;
    const extraLines = [];

    extraChecks.forEach((check) => {
      if (!check.checked) return;

      const price = Number(check.dataset.price || 0);
      const calcType = String(check.dataset.calcType || "add");
      const title = String(check.dataset.title || "추가 옵션");
      const optionItem = check.closest(".optionItem");
      const qtyInput = optionItem?.querySelector(".js-option-qty");

      let lineTotal = price;
      let qty = 1;

      if (calcType === "unit") {
        qty = Math.max(1, Number(qtyInput?.value || 1));
        lineTotal = price * qty;
      }

      extraTotal += lineTotal;

      if (lineTotal > 0) {
        extraLines.push(
          calcType === "unit"
            ? `${title} × ${qty} (${formatPrice(lineTotal)})`
            : `${title} (${formatPrice(lineTotal)})`
        );
      } else {
        extraLines.push(title);
      }
    });

    const selectedCollabOption = collabSelect?.selectedOptions?.[0];
    const collabDiscount = Number(selectedCollabOption?.dataset.discount || 0);
    const collabName = collabSelect?.value || "";

    const total = Math.max(0, basePrice + extraTotal - collabDiscount);

    baseSummaryEl.textContent =
      basePrice > 0 ? `${baseTitle}\n${formatPrice(basePrice)}` : baseTitle;

    extraSummaryEl.textContent =
      extraLines.length ? extraLines.join("\n") : "0원";

    discountSummaryEl.textContent =
      collabDiscount > 0 && collabName
        ? `${collabName}\n- ${formatPrice(collabDiscount)}`
        : "0원";

    totalPriceEl.textContent = formatPrice(total);

    return {
      baseTitle,
      basePrice,
      extraTotal,
      extraLines,
      collabName,
      collabDiscount,
      total
    };
  }

  function copyEstimate() {
    const nickname = root.querySelector('[name="nickname"]')?.value?.trim() || "";
    const platform = root.querySelector('[name="platform"]')?.value?.trim() || "";
    const portfolioOpenDate = root.querySelector('[name="portfolioOpenDate"]')?.value?.trim() || "";
    const deadline = root.querySelector('[name="deadline"]')?.value?.trim() || "";
    const riggerLink = root.querySelector('[name="riggerLink"]')?.value?.trim() || "";
    const snsOpen = root.querySelector('[name="snsOpen"]')?.value?.trim() || "";
    const extraRequest = root.querySelector('[name="extraRequest"]')?.value?.trim() || "";

    const result = calculate();

    const text = [
      "[일러스트 신청 양식]",
      "",
      `방송닉네임: ${nickname || "-"}`,
      `방송플랫폼: ${platform || "-"}`,
      `포트폴리오 공개일: ${portfolioOpenDate || "-"}`,
      `희망 마감일 / 데뷔 예정일: ${deadline || "-"}`,
      `리거 아트머그링크: ${riggerLink || "-"}`,
      `작업과정 SNS 공개: ${snsOpen || "-"}`,
      `협업작가님 유무: ${result.collabName || "-"}`,
      "",
      "[기본 옵션]",
      `${result.baseTitle} / ${formatPrice(result.basePrice)}`,
      "",
      "[추가 옵션]",
      result.extraLines.length ? result.extraLines.join("\n") : "-",
      "",
      "[협업 할인]",
      result.collabDiscount > 0
        ? `${result.collabName} / -${formatPrice(result.collabDiscount)}`
        : "-",
      "",
      "[총 예상 금액]",
      formatPrice(result.total),
      "",
      "[추가 요청사항]",
      extraRequest || "-"
    ].join("\n");

    navigator.clipboard.writeText(text)
      .then(() => {
        copyBtn.textContent = "복사 완료";
        setTimeout(() => {
          copyBtn.textContent = "견적 내용 복사";
        }, 1400);
      })
      .catch((err) => {
        console.error("copy failed", err);
      });
  }

  function resetFormState() {
    const firstBase = root.querySelector('input[name="baseOption"]');
    if (firstBase) firstBase.checked = true;

    extraChecks.forEach((check) => {
      check.checked = false;
    });

    root.querySelectorAll(".js-option-qty").forEach((input) => {
      input.value = 1;
      input.disabled = true;
    });

    if (collabSelect) collabSelect.value = "";

    root.querySelectorAll(".formInput, .formTextarea, .formSelect").forEach((field) => {
      if (field.classList.contains("js-collab-select")) return;
      field.value = "";
    });

    updateQtyState();
    calculate();
  }

  baseInputs.forEach((input) => {
    input.addEventListener("change", calculate);
  });

  extraChecks.forEach((check) => {
    check.addEventListener("change", () => {
      updateQtyState();
      calculate();
    });
  });

  root.querySelectorAll(".js-option-qty").forEach((input) => {
    input.addEventListener("input", () => {
      if (Number(input.value) < 1 || !input.value) input.value = 1;
      calculate();
    });
  });

  if (collabSelect) {
    collabSelect.addEventListener("change", calculate);
  }

  copyBtn?.addEventListener("click", copyEstimate);
  resetBtn?.addEventListener("click", resetFormState);

  updateQtyState();
  calculate();
}

function formatPrice(value) {
  const num = Number(value || 0);
  return `${num.toLocaleString("ko-KR")}원`;
}

function formatPriceShort(value) {
  const num = Number(value || 0);
  if (!num) return "문의";

  if (num >= 10000 && num % 10000 === 0) {
    return `${num / 10000}만원`;
  }

  return formatPrice(num);
}

function escapeFormHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeFormAttr(str) {
  return escapeFormHtml(str);
}

document.addEventListener("DOMContentLoaded", () => {
  renderFormSection("#formSection");
});