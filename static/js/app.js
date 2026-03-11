const INTRO_TEXT_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmjeZc1HPOvDIkR5UDDcnxY7MHfYnYFJabW4D6dcQDnpDJsJIifa32hX2l43WUL7R6O5JBoISgEnOp/pub?gid=530385584&single=true&output=csv";
const INTRO_SLOT_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmjeZc1HPOvDIkR5UDDcnxY7MHfYnYFJabW4D6dcQDnpDJsJIifa32hX2l43WUL7R6O5JBoISgEnOp/pub?gid=735025845&single=true&output=csv";
const NOTICE_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmjeZc1HPOvDIkR5UDDcnxY7MHfYnYFJabW4D6dcQDnpDJsJIifa32hX2l43WUL7R6O5JBoISgEnOp/pub?gid=0&single=true&output=csv";
const COLLAB_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmjeZc1HPOvDIkR5UDDcnxY7MHfYnYFJabW4D6dcQDnpDJsJIifa32hX2l43WUL7R6O5JBoISgEnOp/pub?gid=1854392720&single=true&output=csv";
const SAMPLE_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmjeZc1HPOvDIkR5UDDcnxY7MHfYnYFJabW4D6dcQDnpDJsJIifa32hX2l43WUL7R6O5JBoISgEnOp/pub?gid=342370995&single=true&output=csv";
const FORM_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQmjeZc1HPOvDIkR5UDDcnxY7MHfYnYFJabW4D6dcQDnpDJsJIifa32hX2l43WUL7R6O5JBoISgEnOp/pub?gid=1580835135&single=true&output=csv";
const COLLAB_DISCOUNT_CSV_URL = COLLAB_CSV_URL;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
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
      if (row.some(cell => String(cell).trim() !== "")) rows.push(row);
      row = [];
      i += 1;
      continue;
    }

    field += char;
    i += 1;
  }

  if (field.length || row.length) {
    row.push(field);
    if (row.some(cell => String(cell).trim() !== "")) rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map(v => String(v).trim());

  return rows.slice(1).map(cols => {
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = String(cols[idx] ?? "").trim();
    });
    return obj;
  });
}

async function fetchCsvRows(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`CSV fetch failed: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  return parseCsv(text);
}

function parsePrice(value) {
  const normalized = String(value ?? "").replace(/[^\d.-]/g, "").trim();
  if (!normalized) return 0;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function formatPrice(value) {
  const num = Number(value || 0);
  return `${num.toLocaleString("ko-KR")}원`;
}

function formatPriceShort(value) {
  const num = Number(value || 0);
  if (!num) return "문의";
  if (num >= 10000 && num % 10000 === 0) return `${num / 10000}만원`;
  return formatPrice(num);
}

function convertDriveUrlToDirect(url) {
  const value = String(url || "").trim();
  if (!value) return "";

  const fileMatch = value.match(/\/file\/d\/([^/]+)/);
  if (fileMatch?.[1]) return `https://lh3.googleusercontent.com/d/${fileMatch[1]}`;

  const idMatch = value.match(/[?&]id=([^&]+)/);
  if (idMatch?.[1]) return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;

  return value;
}

function mountLoading(targetSelector, html) {
  const mount = document.querySelector(targetSelector);
  if (!mount) return null;
  mount.innerHTML = html;
  return mount;
}

function normalizeIntroText(rows) {
  if (!Array.isArray(rows) || !rows.length) return "";
  return String(rows[0]?.text || "").trim();
}

function normalizeSlotValue(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "open") return { state: "open", label: "OPEN", mark: "○" };
  if (raw === "closed") return { state: "closed", label: "CLOSED", mark: "●" };
  return { state: "unknown", label: raw ? raw.toUpperCase() : "-", mark: "–" };
}

function normalizeIntroSlots(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map(row => ({
      month: String(row.month || "").trim(),
      slots: [
        normalizeSlotValue(row["slot 1"]),
        normalizeSlotValue(row["slot 2"]),
        normalizeSlotValue(row["slot 3"])
      ]
    }))
    .filter(item => item.month);
}

function buildIntroTextHtml(text) {
  return `
    <div class="introBadge">Illustrator · Live2D</div>
    <div class="introTextBox">
      <p class="introText">${escapeHtml(text)}</p>
    </div>
  `;
}

function buildIntroSlotHtml(rows) {
  const rowHtml = rows.map(row => {
    const cells = row.slots.map(slot => `
      <div class="slotCell is-${escapeAttr(slot.state)}">
        <span class="slotCell__mark">${escapeHtml(slot.mark)}</span>
        <span class="slotCell__label">${escapeHtml(slot.label)}</span>
      </div>
    `).join("");

    return `
      <div class="slotRow">
        <div class="slotMonth">${escapeHtml(row.month)}</div>
        ${cells}
      </div>
    `;
  }).join("");

  return `
    <aside class="slotPanel">
      <div class="slotPanel__head">
        <h3 class="slotPanel__title">작업 슬롯 현황</h3>
        <div class="slotPanel__legend">
          <span class="slotLegend"><span class="slotLegend__mark">●</span>CLOSED</span>
          <span class="slotLegend"><span class="slotLegend__mark">○</span>OPEN</span>
        </div>
      </div>
      <div class="slotGrid">
        ${rowHtml}
      </div>
    </aside>
  `;
}

async function renderIntroSection(targetSelector = "#introSection") {
  const mount = mountLoading(targetSelector, `
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
  `);

  if (!mount) return;

  const leftEl = mount.querySelector(".introCard__left");
  const rightEl = mount.querySelector(".introCard__right");

  try {
    const [textRows, slotRows] = await Promise.all([
      fetchCsvRows(INTRO_TEXT_CSV),
      fetchCsvRows(INTRO_SLOT_CSV)
    ]);

    leftEl.innerHTML = buildIntroTextHtml(normalizeIntroText(textRows));
    rightEl.innerHTML = buildIntroSlotHtml(normalizeIntroSlots(slotRows));
  } catch (error) {
    console.error("[renderIntroSection]", error);
    if (leftEl) leftEl.innerHTML = `<div class="introError">소개 문구를 불러오지 못했습니다.</div>`;
    if (rightEl) rightEl.innerHTML = `<div class="introError">슬롯 정보를 불러오지 못했습니다.</div>`;
  }
}

function groupNoticeRows(rows) {
  const map = new Map();

  (Array.isArray(rows) ? rows : []).forEach(row => {
    const group = String(row.group || "").trim();
    const desc = String(row.desc || "").trim();
    const order = Number(String(row.order || "").trim());

    if (!group || !desc) return;

    if (!map.has(group)) map.set(group, []);
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

function buildNoticeSectionHtml(groups) {
  return `
    <div class="noticeHeader">
      <div class="noticeBadge">Notice Guide</div>
      <div class="noticeTitleRow">
        <div class="noticeTitleBox">
          <h2 class="noticeTitle">작업 공지사항</h2>
          <p class="noticeLead"><strong>※</strong> 본 공지를 숙지하지 않아 발생하는 모든 문제에 대해 작가는 책임지지 않습니다.</p>
        </div>
      </div>
    </div>
    <div class="noticeGroupGrid">
      ${groups.map(group => `
        <article class="noticeCard">
          <div class="noticeCard__head">
            <span class="noticeCard__bullet" aria-hidden="true">♡</span>
            <h3 class="noticeCard__title">${escapeHtml(group.group)}</h3>
          </div>
          <ul class="noticeList">
            ${group.items.map((item, idx) => `
              <li class="noticeItem">
                <span class="noticeItem__num">${idx + 1}</span>
                <div class="noticeItem__text">${escapeHtml(item.desc)}</div>
              </li>
            `).join("")}
          </ul>
        </article>
      `).join("")}
    </div>
  `;
}

async function renderNoticeSection(targetSelector = "#noticeSection") {
  const mount = mountLoading(targetSelector, `
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
  `);

  if (!mount) return;

  const contentEl = mount.querySelector(".noticeContent");

  try {
    const rows = await fetchCsvRows(NOTICE_CSV_URL);
    const groups = groupNoticeRows(rows);
    contentEl.innerHTML = buildNoticeSectionHtml(groups);
  } catch (error) {
    console.error("[renderNoticeSection]", error);
    contentEl.innerHTML = `<div class="noticeError">공지사항을 불러오지 못했습니다.</div>`;
  }
}

function normalizeCollabRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map(row => {
      const order = Number(String(row.order || "").trim());
      return {
        order: Number.isFinite(order) ? order : 999,
        name: String(row.name || "").trim(),
        desc: String(row.desc || "").trim(),
        link: String(row.link || "").trim(),
        price: parsePrice(row.price),
        isPlaceholder: false
      };
    })
    .filter(item => item.name)
    .sort((a, b) => a.order - b.order);
}

function buildCollabPlaceholder(index) {
  return {
    order: index + 1,
    name: "협업 준비중입니다",
    desc: "새로운 작가님과 협업을 준비중이에요!",
    link: "",
    price: 0,
    isPlaceholder: true
  };
}

function buildCollabSectionHtml(items) {
  const visibleItems = items.length >= 3
    ? items
    : [...items, ...Array.from({ length: 3 - items.length }, (_, index) => buildCollabPlaceholder(items.length + index))];

  return `
    <div class="collabHeader">
      <div class="collabBadge">Collaboration Artist</div>
      <div class="collabTitleBox">
        <h2 class="collabTitle">협업 작가</h2>
        <p class="collabLead">함께 진행 가능한 협업 작가님들을 안내드립니다.</p>
      </div>
    </div>
    <div class="collabGrid">
      ${visibleItems.map(item => {
        if (item.isPlaceholder) {
          return `
            <article class="collabCard is-placeholder">
              <div class="collabCard__x collabCard__x--top" aria-hidden="true"></div>
              <div class="collabCard__x collabCard__x--bottom" aria-hidden="true"></div>
              <div class="collabCard__inner">
                <div class="collabCard__head">
                  <span class="collabCard__status">Coming Soon</span>
                  <h3 class="collabCard__name">${escapeHtml(item.name)}</h3>
                </div>
                <p class="collabCard__desc">${escapeHtml(item.desc)}</p>
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
                <span class="collabCard__order">COLLAB ${escapeHtml(item.order)}</span>
                <h3 class="collabCard__name">${escapeHtml(item.name)}</h3>
              </div>
              <p class="collabCard__desc">${escapeHtml(item.desc)}</p>
              <div class="collabCard__meta">
                ${item.price ? `<span class="collabCard__price">${escapeHtml(formatPriceShort(item.price))} 할인</span>` : ``}
              </div>
              <div class="collabCard__footer">
                ${item.link ? `<a class="collabCard__link" href="${escapeAttr(item.link)}" target="_blank" rel="noopener noreferrer">아트머그로 이동</a>` : `<span class="collabCard__link is-disabled">링크 준비중</span>`}
              </div>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

async function renderCollabSection(targetSelector = "#collabSection") {
  const mount = mountLoading(targetSelector, `
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
  `);

  if (!mount) return;

  const contentEl = mount.querySelector(".collabContent");

  try {
    const rows = await fetchCsvRows(COLLAB_CSV_URL);
    const items = normalizeCollabRows(rows);
    contentEl.innerHTML = buildCollabSectionHtml(items);
  } catch (error) {
    console.error("[renderCollabSection]", error);
    contentEl.innerHTML = `<div class="collabError">협업 작가 정보를 불러오지 못했습니다.</div>`;
  }
}

function normalizeSampleRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map(row => {
      const order = Number(String(row.order || "").trim());
      return {
        group: String(row.group || "").trim(),
        order: Number.isFinite(order) ? order : 999,
        title: String(row.title || "").trim(),
        desc: String(row.desc || "").trim(),
        imageUrl: convertDriveUrlToDirect(row.image_url)
      };
    })
    .filter(item => item.group && item.imageUrl)
    .sort((a, b) => a.order - b.order);
}

function groupSampleItems(items) {
  const map = new Map();

  items.forEach(item => {
    if (!map.has(item.group)) map.set(item.group, []);
    map.get(item.group).push(item);
  });

  return Array.from(map.entries()).map(([name, groupItems]) => ({
    name,
    items: [...groupItems].sort((a, b) => a.order - b.order)
  }));
}

function buildSampleSectionHtml(groups) {
  return `
    <div class="sampleHeader">
      <div class="sampleBadge">Sample Preview</div>
      <div class="sampleTitleBox">
        <h2 class="sampleTitle">샘플</h2>
        <p class="sampleLead">작업 예시를 클릭하면 새 창에서 크게 확인하실 수 있습니다.</p>
      </div>
    </div>
    <div class="sampleGroups">
      ${groups.map(group => `
        <section class="sampleGroup">
          <div class="sampleGroup__head">
            <h3 class="sampleGroup__title">${escapeHtml(group.name)}</h3>
            <span class="sampleGroup__count">${group.items.length} SAMPLE</span>
          </div>
          <div class="sampleGrid">
            ${group.items.map(item => {
              const safeTitle = escapeHtml(item.title);
              const safeDesc = escapeHtml(item.desc);
              const safeHref = escapeAttr(item.imageUrl);
              return `
                <a class="sampleCard" href="${safeHref}" target="_blank" rel="noopener noreferrer" aria-label="${safeTitle} 새 창에서 크게 보기">
                  <div class="sampleCard__thumb">
                    <img src="${safeHref}" alt="${safeTitle}" loading="lazy" referrerpolicy="no-referrer">
                    <span class="sampleCard__zoom">VIEW</span>
                  </div>
                  <div class="sampleCard__body">
                    <div class="sampleCard__top">
                      <span class="sampleCard__order">NO.${escapeHtml(item.order)}</span>
                    </div>
                    <h4 class="sampleCard__title">${safeTitle}</h4>
                    <p class="sampleCard__desc">${safeDesc}</p>
                  </div>
                </a>
              `;
            }).join("")}
          </div>
        </section>
      `).join("")}
    </div>
  `;
}

async function renderSampleSection(targetSelector = "#sampleSection") {
  const mount = mountLoading(targetSelector, `
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
  `);

  if (!mount) return;

  const contentEl = mount.querySelector(".sampleContent");

  try {
    const rows = await fetchCsvRows(SAMPLE_CSV_URL);
    const items = normalizeSampleRows(rows);
    const groups = groupSampleItems(items);

    if (!groups.length) {
      contentEl.innerHTML = `<div class="sampleEmpty">등록된 샘플이 없습니다.</div>`;
      return;
    }

    contentEl.innerHTML = buildSampleSectionHtml(groups);
  } catch (error) {
    console.error("[renderSampleSection]", error);
    contentEl.innerHTML = `<div class="sampleError">샘플 이미지를 불러오지 못했습니다.</div>`;
  }
}

function normalizeFormPricingRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map(row => {
      const order = Number(row.order || 999);
      return {
        group: String(row.group || "").trim(),
        order: Number.isFinite(order) ? order : 999,
        title: String(row.title || "").trim(),
        desc: String(row.desc || "").trim(),
        calcType: String(row.calc_type || "add").trim().toLowerCase(),
        price: parsePrice(row.price)
      };
    })
    .filter(item => item.group && item.title)
    .sort((a, b) => {
      if (a.group === b.group) return a.order - b.order;
      return a.group.localeCompare(b.group, "ko");
    });
}

function normalizeCollabDiscountRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map(row => {
      const order = Number(row.order || 999);
      return {
        order: Number.isFinite(order) ? order : 999,
        name: String(row.name || "").trim(),
        desc: String(row.desc || "").trim(),
        link: String(row.link || "").trim(),
        price: parsePrice(row.price)
      };
    })
    .filter(item => item.name)
    .sort((a, b) => a.order - b.order);
}

function buildOptionCardHtml(item, type, index) {
  const priceText = formatPriceShort(item.price);

  if (type === "base") {
    return `
      <label class="formOptionCard is-base">
        <input class="formOptionInput js-base-option" type="radio" name="baseOption" value="${escapeAttr(index)}" ${index === 0 ? "checked" : ""}>
        <span class="formOptionBody">
          <span class="formOptionTitle">${escapeHtml(item.title)}</span>
          <span class="formOptionPrice">${escapeHtml(priceText)}</span>
          ${item.desc ? `<span class="formOptionDesc">${escapeHtml(item.desc)}</span>` : ``}
        </span>
      </label>
    `;
  }

  const isUnit = item.calcType === "unit";

  return `
    <div class="formOptionCard is-extra ${isUnit ? "is-unit" : "is-flat"}">
      <label class="formOptionBody">
        <input class="formOptionInput js-extra-option" type="checkbox" data-index="${escapeAttr(index)}">
        <span class="formOptionTitle">${escapeHtml(item.title)}</span>
        <span class="formOptionPrice">${escapeHtml(priceText)}</span>
        ${item.desc ? `<span class="formOptionDesc">${escapeHtml(item.desc)}</span>` : ``}
      </label>
      ${isUnit ? `
        <div class="formOptionQty">
          <span class="formOptionQty__label">수량</span>
          <input class="formQtyInput js-option-qty" type="number" min="1" step="1" value="1" data-index="${escapeAttr(index)}" disabled>
        </div>
      ` : ``}
    </div>
  `;
}

function buildFormSectionHtml(pricingData, collabData) {
  const baseOptions = pricingData.filter(item => item.group === "기본 옵션");
  const extraOptions = pricingData.filter(item => item.group !== "기본 옵션");

  return `
    <div class="formHeader">
      <div class="formBadge">Application Form</div>
      <div class="formTitleBox">
        <h2 class="formTitle">신청 양식</h2>
        <p class="formLead">기본 옵션과 추가 옵션을 선택하면 예상 금액을 바로 확인할 수 있습니다.</p>
      </div>
    </div>

    <div class="formGrid">
      <div class="formMain">
        <section class="formBlock">
          <div class="formBlock__head">
            <h3 class="formBlock__title">신청 정보</h3>
          </div>

          <div class="formFieldGrid">
            <div class="formField">
              <label class="formLabel" for="clientName">닉네임</label>
              <input id="clientName" class="formInput js-client-name" type="text" placeholder="신청자 닉네임">
            </div>

            <div class="formField">
              <label class="formLabel" for="contactInfo">연락처</label>
              <input id="contactInfo" class="formInput js-contact-info" type="text" placeholder="메일 / 오픈채팅 / SNS">
            </div>
          </div>

          <div class="formField">
            <label class="formLabel" for="requestDetail">추가 요청사항</label>
            <textarea id="requestDetail" class="formTextarea js-extra-request" rows="5" placeholder="원하는 작업 방향이나 추가 요청사항을 적어주세요."></textarea>
          </div>
        </section>

        <section class="formBlock">
          <div class="formBlock__head">
            <h3 class="formBlock__title">기본 옵션</h3>
          </div>
          <div class="formOptionList">
            ${baseOptions.length ? baseOptions.map((item, index) => buildOptionCardHtml(item, "base", index)).join("") : `<div class="formEmpty">기본 옵션 데이터가 없습니다.</div>`}
          </div>
        </section>

        <section class="formBlock">
          <div class="formBlock__head">
            <h3 class="formBlock__title">추가 옵션</h3>
          </div>
          <div class="formExtraList">
            ${extraOptions.length ? extraOptions.map((item, index) => buildOptionCardHtml(item, "extra", index)).join("") : `<div class="formEmpty">추가 옵션 데이터가 없습니다.</div>`}
          </div>
        </section>

        <section class="formBlock">
          <div class="formBlock__head">
            <h3 class="formBlock__title">협업 할인</h3>
          </div>
          <div class="formField">
            <label class="formLabel" for="collabSelect">협업 작가 선택</label>
            <select id="collabSelect" class="formSelect js-collab-select">
              <option value="">선택 안 함</option>
              ${collabData.map((item, index) => `<option value="${escapeAttr(index)}">${escapeHtml(item.name)}${item.price ? ` · ${escapeHtml(formatPriceShort(item.price))} 할인` : ""}</option>`).join("")}
            </select>
          </div>
        </section>
      </div>

      <aside class="formAside">
        <section class="formEstimate">
          <div class="formEstimate__head">
            <h3 class="formEstimate__title">예상 견적</h3>
          </div>

          <div class="formEstimate__body">
            <div class="estimateRow">
              <span class="estimateLabel">기본 옵션</span>
              <strong class="estimateValue js-estimate-base">0원</strong>
            </div>
            <div class="estimateDetail js-estimate-base-name">-</div>

            <div class="estimateRow">
              <span class="estimateLabel">추가 옵션</span>
              <strong class="estimateValue js-estimate-extra">0원</strong>
            </div>
            <div class="estimateDetail js-estimate-extra-list">선택 없음</div>

            <div class="estimateRow">
              <span class="estimateLabel">협업 할인</span>
              <strong class="estimateValue js-estimate-discount">0원</strong>
            </div>
            <div class="estimateDetail js-estimate-collab-name">선택 없음</div>

            <div class="estimateDivider"></div>

            <div class="estimateTotal">
              <span class="estimateTotal__label">최종 예상 금액</span>
              <strong class="estimateTotal__value js-estimate-total">0원</strong>
            </div>
          </div>

          <div class="formEstimate__actions">
            <button type="button" class="formActionBtn js-copy-estimate">견적 내용 복사</button>
            <button type="button" class="formActionBtn is-sub js-reset-form">초기화</button>
          </div>
        </section>
      </aside>
    </div>
  `;
}

function setupFormCalculator(root, pricingData, collabData) {
  const baseOptions = pricingData.filter(item => item.group === "기본 옵션");
  const extraOptions = pricingData.filter(item => item.group !== "기본 옵션");

  const baseInputs = [...root.querySelectorAll(".js-base-option")];
  const extraChecks = [...root.querySelectorAll(".js-extra-option")];
  const qtyInputs = [...root.querySelectorAll(".js-option-qty")];

  const collabSelect = root.querySelector(".js-collab-select");
  const copyBtn = root.querySelector(".js-copy-estimate");
  const resetBtn = root.querySelector(".js-reset-form");

  const basePriceEl = root.querySelector(".js-estimate-base");
  const baseNameEl = root.querySelector(".js-estimate-base-name");
  const extraPriceEl = root.querySelector(".js-estimate-extra");
  const extraListEl = root.querySelector(".js-estimate-extra-list");
  const discountEl = root.querySelector(".js-estimate-discount");
  const collabNameEl = root.querySelector(".js-estimate-collab-name");
  const totalEl = root.querySelector(".js-estimate-total");

  function getSelectedBase() {
    const checked = baseInputs.find(input => input.checked);
    if (!checked) return null;
    const index = Number(checked.value);
    return baseOptions[index] || null;
  }

  function updateQtyState() {
    extraChecks.forEach(check => {
      const index = Number(check.dataset.index);
      const option = extraOptions[index];
      const qtyInput = qtyInputs.find(input => Number(input.dataset.index) === index);

      if (!qtyInput) return;

      const isUnit = option?.calcType === "unit";
      qtyInput.disabled = !isUnit || !check.checked;

      if (!isUnit || !check.checked) {
        qtyInput.value = 1;
      }
    });
  }

  function getSelectedExtras() {
    return extraChecks
      .filter(check => check.checked)
      .map(check => {
        const index = Number(check.dataset.index);
        const option = extraOptions[index];
        const qtyInput = qtyInputs.find(input => Number(input.dataset.index) === index);
        const isUnit = option?.calcType === "unit";
        const quantity = isUnit ? Math.max(1, Number(qtyInput?.value || 1)) : 1;

        return {
          ...option,
          quantity,
          totalPrice: option.price * quantity
        };
      });
  }

  function getSelectedCollab() {
    const raw = collabSelect?.value;
    if (raw === "" || raw == null) return null;
    const index = Number(raw);
    return Number.isFinite(index) ? collabData[index] || null : null;
  }

  function calculate() {
    const base = getSelectedBase();
    const extras = getSelectedExtras();
    const collab = getSelectedCollab();

    const basePrice = base?.price || 0;
    const extraPrice = extras.reduce((sum, item) => sum + item.totalPrice, 0);
    const discount = collab?.price || 0;
    const total = Math.max(0, basePrice + extraPrice - discount);

    if (basePriceEl) basePriceEl.textContent = formatPrice(basePrice);
    if (baseNameEl) baseNameEl.textContent = base ? `${base.title}${base.desc ? ` · ${base.desc}` : ""}` : "-";

    if (extraPriceEl) extraPriceEl.textContent = formatPrice(extraPrice);
    if (extraListEl) extraListEl.textContent = extras.length ? extras.map(item => `${item.title} × ${item.quantity}`).join(", ") : "선택 없음";

    if (discountEl) discountEl.textContent = collab ? `-${formatPrice(discount)}` : formatPrice(0);
    if (collabNameEl) collabNameEl.textContent = collab ? collab.name : "선택 없음";
    if (totalEl) totalEl.textContent = formatPrice(total);

    return { base, extras, collab, basePrice, extraPrice, discount, total };
  }

  function copyEstimate() {
    const result = calculate();
    const nickname = root.querySelector(".js-client-name")?.value?.trim() || "-";
    const contact = root.querySelector(".js-contact-info")?.value?.trim() || "-";
    const extraRequest = root.querySelector(".js-extra-request")?.value?.trim() || "-";

    const text = [
      "[신청자 정보]",
      `닉네임: ${nickname}`,
      `연락처: ${contact}`,
      "",
      "[기본 옵션]",
      result.base ? `${result.base.title} / ${formatPrice(result.basePrice)}` : "-",
      "",
      "[추가 옵션]",
      result.extras.length ? result.extras.map(item => `${item.title} × ${item.quantity} / ${formatPrice(item.totalPrice)}`).join("\n") : "선택 없음",
      "",
      "[협업 할인]",
      result.collab ? `${result.collab.name} / -${formatPrice(result.discount)}` : "선택 없음",
      "",
      "[최종 예상 금액]",
      formatPrice(result.total),
      "",
      "[추가 요청사항]",
      extraRequest
    ].join("\n");

    navigator.clipboard.writeText(text).then(() => {
      if (!copyBtn) return;
      const original = copyBtn.textContent;
      copyBtn.textContent = "복사 완료";
      setTimeout(() => {
        copyBtn.textContent = original;
      }, 1400);
    }).catch(error => {
      console.error("copy failed", error);
    });
  }

  function resetFormState() {
    const firstBase = baseInputs[0];
    if (firstBase) firstBase.checked = true;

    extraChecks.forEach(check => {
      check.checked = false;
    });

    qtyInputs.forEach(input => {
      input.value = 1;
      input.disabled = true;
    });

    if (collabSelect) collabSelect.value = "";
    root.querySelectorAll(".formInput, .formTextarea").forEach(field => {
      field.value = "";
    });

    updateQtyState();
    calculate();
  }

  baseInputs.forEach(input => {
    input.addEventListener("change", calculate);
  });

  extraChecks.forEach(check => {
    check.addEventListener("change", () => {
      updateQtyState();
      calculate();
    });
  });

  qtyInputs.forEach(input => {
    input.addEventListener("input", () => {
      if (!input.value || Number(input.value) < 1) input.value = 1;
      calculate();
    });
  });

  if (collabSelect) collabSelect.addEventListener("change", calculate);
  if (copyBtn) copyBtn.addEventListener("click", copyEstimate);
  if (resetBtn) resetBtn.addEventListener("click", resetFormState);

  updateQtyState();
  calculate();
}

async function renderFormSection(targetSelector = "#formSection") {
  const mount = mountLoading(targetSelector, `
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
  `);

  if (!mount) return;

  const contentEl = mount.querySelector(".formContent");

  try {
    const [formRows, collabRows] = await Promise.all([
      fetchCsvRows(FORM_CSV_URL),
      fetchCsvRows(COLLAB_DISCOUNT_CSV_URL)
    ]);

    const pricingData = normalizeFormPricingRows(formRows);
    const collabData = normalizeCollabDiscountRows(collabRows);

    contentEl.innerHTML = buildFormSectionHtml(pricingData, collabData);
    setupFormCalculator(mount, pricingData, collabData);
  } catch (error) {
    console.error("[renderFormSection]", error);
    contentEl.innerHTML = `<div class="formError">신청 양식 정보를 불러오지 못했습니다.</div>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderIntroSection("#introSection");
  renderNoticeSection("#noticeSection");
  renderCollabSection("#collabSection");
  renderSampleSection("#sampleSection");
  renderFormSection("#formSection");
});