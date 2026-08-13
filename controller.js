const STORAGE_KEY = "horarios.subjects.v1";

let table;
let nameInput;
let codeInput;
let addButton;
let pdfButton;
let clearButton;
let messageEl;
let subjectsEl;

/** @type {{id:string,name:string,code:string,color:string,cells:string[]}[]} */
let subjects = [];

/** @type {Map<string, HTMLElement>} */
let cellsById = new Map();

/** @type {string[]} */
let allCellIds = [];

/** @type {string[]} */
let previewCellIds = [];

function uuid() {
	if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
	return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

window.addEventListener("DOMContentLoaded", () => {
	table = document.getElementById("table");
	nameInput = document.getElementById("input_nome");
	codeInput = document.getElementById("input_codigo");
	addButton = document.getElementById("btn_add");
	pdfButton = document.getElementById("btn_pdf");
	clearButton = document.getElementById("btn_clear");
	messageEl = document.getElementById("message");
	subjectsEl = document.getElementById("subjects");

	generate_table();
	buildCellIndex();
	loadSubjects();
	renderSubjects();
	renderGrid();

	codeInput.addEventListener("input", onDraftChange, false);
	nameInput.addEventListener("input", onDraftChange, false);
	addButton.addEventListener("click", onAdd, false);
	if (pdfButton) pdfButton.addEventListener("click", onExportPDF, false);
	clearButton.addEventListener("click", onClear, false);

	onDraftChange();
});

function generate_table() {
	for (var turno = 1; turno <= 3; turno++) {
		for (var i = 1; i <= (7 - turno); i++) {
			let row = this.table.insertRow(-1);
			for (var j = 1; j <= 7; j++) {
				if (j == 1) {
					let cell = row.insertCell();
					cell.setAttribute("class", `hour_description`);
					let horario = i + 6 + (turno == 2 ? 6 : turno == 3 ? 11 : 0);
					let text = document.createElement("p");
					text.innerHTML = `${horario}:${turno == 3 ? '30' : '00'} - ${horario + 1}:${turno == 3 ? '30' : '00'}`;

					cell.appendChild(text);
				} else {
					let cell = row.insertCell();
					let div = document.createElement("div");
					div.setAttribute("id", `${j}${turno == 1 ? 'M' : turno == 2 ? 'T' : 'N'}${i}`)
					div.setAttribute("class", `hour_block`);
					cell.appendChild(div);
				}
			}
		}
	}
}

function buildCellIndex() {
	cellsById = new Map();
	allCellIds = [];
	document.querySelectorAll(".hour_block").forEach((el) => {
		cellsById.set(el.id, el);
		allCellIds.push(el.id);
	});
}

function hexToRgb(hex) {
	if (!hex || typeof hex !== "string" || !hex.startsWith("#")) return [128, 128, 128];
	let c = hex.replace("#", "");
	if (c.length === 3) c = c.split("").map((x) => x + x).join("");
	const num = parseInt(c, 16);
	if (isNaN(num)) return [128, 128, 128];
	return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function getHue(hex) {
	const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
	const max = Math.max(r, g, b), min = Math.min(r, g, b);
	let h = 0;
	if (max !== min) {
		const d = max - min;
		switch (max) {
			case r: h = (g - b) / d + (g < b ? 6 : 0); break;
			case g: h = (b - r) / d + 2; break;
			case b: h = (r - g) / d + 4; break;
		}
		h /= 6;
	}
	return h * 360;
}

function colorDistance(hex1, hex2) {
	const h1 = getHue(hex1);
	const h2 = getHue(hex2);
	const diff = Math.abs(h1 - h2);
	const hueDiff = Math.min(diff, 360 - diff);
	
	const [r1, g1, b1] = hexToRgb(hex1);
	const [r2, g2, b2] = hexToRgb(hex2);
	const rgbDiff = Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2) / 441.67;
	
	// 80% de peso no contraste de Matiz (Hue) para impedir cores da mesma família
	return (hueDiff / 180) * 0.80 + rgbDiff * 0.20;
}

function pickColorFor(usedColors, index) {
	const palette = [
		"#00F0FF", // Cyan Elétrico (180°)
		"#FF2A4B", // Vermelho Vivo (350°)
		"#39FF14", // Verde Limão Neon (110°)
		"#FF6B00", // Laranja Puro (25°)
		"#9D00FF", // Roxo Intenso (275°)
		"#FF007F", // Rosa Magenta (330°)
		"#FFE600", // Amarelo Canário (55°)
		"#00FFAB", // Verde Mint / Teal (160°)
		"#1F51FF", // Azul Cobalto (225°)
		"#E000FF", // Fuchsia / Orquídea (290°)
		"#FFD000", // Amarelo Ouro (48°)
		"#00A86B", // Verde Esmeralda (158°)
		"#6F00FF", // Azul Índigo (266°)
		"#FF5733", // Coral (10°)
		"#A3E635", // Lime Green (84°)
		"#00A3FF", // Azul Celeste (200°)
	];

	const available = palette.filter((c) => !usedColors.has(c));

	if (usedColors.size === 0) {
		return palette[0];
	}

	if (available.length > 0) {
		let bestColor = available[0];
		let maxMinDist = -1;

		for (const candidate of available) {
			let minDistToUsed = Infinity;
			for (const used of usedColors) {
				const dist = colorDistance(candidate, used);
				if (dist < minDistToUsed) {
					minDistToUsed = dist;
				}
			}
			if (minDistToUsed > maxMinDist) {
				maxMinDist = minDistToUsed;
				bestColor = candidate;
			}
		}

		return bestColor;
	}

	const hue = Math.round((index * 137.5) % 360);
	return `hsl(${hue}, 95%, 55%)`;
}

function pickColor() {
	const used = new Set(subjects.map((s) => s.color).filter(Boolean));
	return pickColorFor(used, subjects.length);
}

function loadSubjects() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			subjects = [];
			return;
		}
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			subjects = [];
			return;
		}

		const incoming = parsed.filter((s) => s && typeof s === "object");
		const used = new Set();
		subjects = incoming.map((s, idx) => {
			const validColor = s.color && s.color !== "undefined" && s.color !== "null" && typeof s.color === "string";
			const color = validColor ? s.color : pickColorFor(used, idx);
			used.add(color);
			const cells = Array.isArray(s.cells) ? s.cells.map(String) : [];
			return {
				id: String(s.id || uuid()),
				name: String(s.name || "Matéria"),
				code: String(s.code || ""),
				color,
				cells: cells.filter((id) => cellsById.has(id)),
			};
		});
	} catch {
		subjects = [];
	}
}

function saveSubjects() {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(subjects));
}

function setMessage(text, type) {
	messageEl.textContent = text || "";
	messageEl.classList.remove("error", "ok", "info");
	if (type) messageEl.classList.add(type);
}

function currentOccupancy() {
	/** @type {Map<string, string>} */
	const occ = new Map();
	for (const s of subjects) {
		for (const cellId of s.cells) {
			occ.set(cellId, s.id);
		}
	}
	return occ;
}

function parseScheduleCode(raw) {
	const code = String(raw || "").trim();
	if (!code) return { cells: new Set(), errors: [] };

	const tokens = code.split(/\s+/).filter(Boolean).map((t) => t.toUpperCase());
	/** @type {string[]} */
	const errors = [];
	/** @type {Set<string>} */
	const cells = new Set();

	for (const token of tokens) {
		const turnIndex = token.search(/[MTN]/);
		/** @type {string[]} */
		let prefixes = [];

		if (turnIndex >= 0) {
			const turno = token[turnIndex];
			const daysPart = token.slice(0, turnIndex);
			const hoursPart = token.slice(turnIndex + 1);

			if (!daysPart) {
				errors.push(`"${token}": faltou o dia (2-7) antes do turno`);
				continue;
			}

			const days = daysPart.split("");
			const invalidDay = days.find((d) => !/^[2-7]$/.test(d));
			if (invalidDay) {
				errors.push(`"${token}": dia inválido "${invalidDay}" (use 2-7)`);
				continue;
			}

			if (!hoursPart) {
				prefixes = days.map((d) => `${d}${turno}`);
			} else {
				const hours = hoursPart.split("");
				const maxByTurno = turno === "M" ? 6 : turno === "T" ? 5 : 4;
				const invalidHour = hours.find((h) => !new RegExp(`^[1-${maxByTurno}]$`).test(h));
				if (invalidHour) {
					errors.push(
						`"${token}": horário inválido "${invalidHour}" para ${turno} (use 1-${maxByTurno})`
					);
					continue;
				}

				for (const d of days) {
					for (const h of hours) {
						prefixes.push(`${d}${turno}${h}`);
					}
				}
			}
		} else {
			const days = token.split("");
			const invalidDay = days.find((d) => !/^[2-7]$/.test(d));
			if (invalidDay) {
				errors.push(`"${token}": dia inválido "${invalidDay}" (use 2-7)`);
				continue;
			}
			prefixes = days;
		}

		for (const prefix of prefixes) {
			const matched = allCellIds.filter((id) => id.startsWith(prefix));
			if (!matched.length) {
				errors.push(`"${token}": não encontrei nada para "${prefix}"`);
				continue;
			}
			for (const id of matched) cells.add(id);
		}
	}

	return { cells, errors };
}

function renderSubjects() {
	subjectsEl.innerHTML = "";
	if (!subjects.length) {
		const empty = document.createElement("p");
		empty.className = "subjects_empty";
		empty.textContent = "Nenhuma matéria adicionada ainda.";
		subjectsEl.appendChild(empty);
		return;
	}

	for (const s of subjects) {
		const row = document.createElement("div");
		row.className = "subject";

		const badge = document.createElement("span");
		badge.className = "subject_badge";
		badge.style.backgroundColor = s.color;
		badge.title = s.name;

		const meta = document.createElement("div");
		meta.className = "subject_meta";

		const title = document.createElement("div");
		title.className = "subject_title";
		title.textContent = s.name;

		const code = document.createElement("div");
		code.className = "subject_code";
		code.textContent = s.code;

		meta.appendChild(title);
		meta.appendChild(code);

		const remove = document.createElement("button");
		remove.type = "button";
		remove.className = "subject_remove";
		remove.textContent = "Remover";
		remove.addEventListener("click", () => {
			subjects = subjects.filter((x) => x.id !== s.id);
			saveSubjects();
			renderSubjects();
			renderGrid();
			onDraftChange();
		});

		row.appendChild(badge);
		row.appendChild(meta);
		row.appendChild(remove);
		subjectsEl.appendChild(row);
	}
}

function clearPreview() {
	for (const id of previewCellIds) {
		const el = cellsById.get(id);
		if (!el) continue;
		el.classList.remove("preview", "conflict");
	}
	previewCellIds = [];
}

function renderGrid() {
	for (const el of cellsById.values()) {
		el.style.backgroundColor = "";
		el.classList.remove("preview", "conflict");
		el.removeAttribute("title");
	}

	for (const s of subjects) {
		for (const id of s.cells) {
			const el = cellsById.get(id);
			if (!el) continue;
			el.style.backgroundColor = s.color;
			el.title = s.name;
		}
	}
}

function onDraftChange() {
	clearPreview();

	const draftCode = codeInput.value;
	const parsed = parseScheduleCode(draftCode);
	const occ = currentOccupancy();
	const conflicts = [];

	for (const id of parsed.cells) {
		if (occ.has(id)) conflicts.push(id);
	}

	previewCellIds = Array.from(parsed.cells);
	for (const id of previewCellIds) {
		const el = cellsById.get(id);
		if (!el) continue;
		el.classList.add("preview");
		if (conflicts.includes(id)) el.classList.add("conflict");
	}

	const hasCode = String(draftCode || "").trim().length > 0;
	const canAdd = hasCode && parsed.errors.length === 0 && conflicts.length === 0 && parsed.cells.size > 0;
	addButton.disabled = !canAdd;

	if (!hasCode) {
		setMessage("Digite o código do horário para pré-visualizar e adicionar.", "info");
		return;
	}
	if (parsed.errors.length) {
		setMessage(parsed.errors[0], "error");
		return;
	}
	if (conflicts.length) {
		setMessage("Choque detectado: esse horário já está ocupado por outra matéria.", "error");
		return;
	}
	setMessage("Pronto para adicionar: sem choques.", "ok");
}

function onAdd() {
	const name = String(nameInput.value || "").trim() || `Matéria ${subjects.length + 1}`;
	const code = String(codeInput.value || "").trim();
	const parsed = parseScheduleCode(code);
	if (parsed.errors.length) {
		setMessage(parsed.errors[0], "error");
		return;
	}
	if (!parsed.cells.size) {
		setMessage("Código vazio ou inválido.", "error");
		return;
	}

	const occ = currentOccupancy();
	for (const id of parsed.cells) {
		if (occ.has(id)) {
			setMessage("Choque detectado: esse horário já está ocupado por outra matéria.", "error");
			return;
		}
	}

	subjects.push({
		id: uuid(),
		name,
		code: code.toUpperCase(),
		color: pickColor(),
		cells: Array.from(parsed.cells),
	});

	saveSubjects();
	renderSubjects();
	renderGrid();
	nameInput.value = "";
	codeInput.value = "";
	onDraftChange();
}

function onClear() {
	if (!subjects.length) return;
	const ok = confirm("Remover todas as matérias salvas? (isso limpa o cache do navegador)");
	if (!ok) return;
	subjects = [];
	saveSubjects();
	renderSubjects();
	renderGrid();
	onDraftChange();
}

async function onExportPDF() {
	if (!subjects.length) {
		setMessage("Adicione ao menos uma matéria para baixar o PDF.", "error");
		return;
	}

	setMessage("Gerando PDF, aguarde...", "info");

	const card = document.createElement("div");
	card.id = "pdf_export_card";
	card.style.position = "fixed";
	card.style.top = "0";
	card.style.left = "0";
	card.style.width = "900px";
	card.style.backgroundColor = "#0F172A";
	card.style.color = "#ffffff";
	card.style.padding = "16px 20px";
	card.style.borderRadius = "12px";
	card.style.border = "1px solid rgba(255,255,255,0.15)";
	card.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, sans-serif";
	card.style.opacity = "0.001";
	card.style.pointerEvents = "none";
	card.style.zIndex = "-99999";

	const header = document.createElement("div");
	header.style.marginBottom = "10px";
	header.style.borderBottom = "1px solid rgba(255,255,255,0.15)";
	header.style.paddingBottom = "6px";
	header.innerHTML = `
		<div style="display:flex; justify-content:space-between; align-items:center;">
			<h1 style="margin:0; font-size:20px; color:#ffffff; font-weight:800;">HORÁRIOS UFRB</h1>
			<span style="font-size:11px; color:rgba(255,255,255,0.65);">Grade Semestral • Emitido em ${new Date().toLocaleDateString("pt-BR")}</span>
		</div>
	`;
	card.appendChild(header);

	const legendGrid = document.createElement("div");
	legendGrid.style.display = "grid";
	legendGrid.style.gridTemplateColumns = "repeat(3, 1fr)";
	legendGrid.style.gap = "4px 8px";
	legendGrid.style.marginBottom = "10px";

	for (const s of subjects) {
		const item = document.createElement("div");
		item.style.display = "flex";
		item.style.alignItems = "center";
		item.style.gap = "6px";
		item.style.padding = "3px 6px";
		item.style.backgroundColor = "#1E293B";
		item.style.borderRadius = "5px";
		item.style.border = "1px solid rgba(255,255,255,0.1)";

		const badge = document.createElement("span");
		badge.style.width = "9px";
		badge.style.height = "9px";
		badge.style.borderRadius = "50%";
		badge.style.backgroundColor = s.color;
		badge.style.flexShrink = "0";

		const nameText = document.createElement("span");
		nameText.style.fontSize = "10px";
		nameText.style.fontWeight = "bold";
		nameText.style.color = "#ffffff";
		nameText.style.whiteSpace = "nowrap";
		nameText.style.overflow = "hidden";
		nameText.style.textOverflow = "ellipsis";
		nameText.textContent = `${s.name} (${s.code})`;

		item.appendChild(badge);
		item.appendChild(nameText);
		legendGrid.appendChild(item);
	}
	card.appendChild(legendGrid);

	const occMap = new Map();
	for (const s of subjects) {
		for (const cellId of s.cells) {
			occMap.set(cellId, s);
		}
	}

	const tableEl = document.createElement("table");
	tableEl.style.width = "100%";
	tableEl.style.borderCollapse = "collapse";
	tableEl.style.tableLayout = "fixed";
	tableEl.style.borderRadius = "6px";
	tableEl.style.overflow = "hidden";
	tableEl.style.border = "1px solid rgba(255,255,255,0.15)";

	const thead = document.createElement("thead");
	thead.innerHTML = `
		<tr style="background-color: #1E293B; color: rgba(255,255,255,0.9); font-size: 10px; text-transform: uppercase; font-weight: 800;">
			<th style="padding: 4px; width: 17%; border-bottom: 1px solid rgba(255,255,255,0.15); border-right: 1px solid rgba(255,255,255,0.15);">Horários</th>
			<th style="padding: 4px; width: 13.8%; border-bottom: 1px solid rgba(255,255,255,0.15); border-right: 1px solid rgba(255,255,255,0.15);">Seg</th>
			<th style="padding: 4px; width: 13.8%; border-bottom: 1px solid rgba(255,255,255,0.15); border-right: 1px solid rgba(255,255,255,0.15);">Ter</th>
			<th style="padding: 4px; width: 13.8%; border-bottom: 1px solid rgba(255,255,255,0.15); border-right: 1px solid rgba(255,255,255,0.15);">Qua</th>
			<th style="padding: 4px; width: 13.8%; border-bottom: 1px solid rgba(255,255,255,0.15); border-right: 1px solid rgba(255,255,255,0.15);">Qui</th>
			<th style="padding: 4px; width: 13.8%; border-bottom: 1px solid rgba(255,255,255,0.15); border-right: 1px solid rgba(255,255,255,0.15);">Sex</th>
			<th style="padding: 4px; width: 13.8%; border-bottom: 1px solid rgba(255,255,255,0.15);">Sab</th>
		</tr>
	`;
	tableEl.appendChild(thead);

	const tbody = document.createElement("tbody");

	for (let turno = 1; turno <= 3; turno++) {
		const maxRow = 7 - turno;
		for (let i = 1; i <= maxRow; i++) {
			const tr = document.createElement("tr");

			const tdHorario = document.createElement("td");
			tdHorario.style.padding = "2px 4px";
			tdHorario.style.fontSize = "9px";
			tdHorario.style.fontWeight = "bold";
			tdHorario.style.color = "rgba(255,255,255,0.85)";
			tdHorario.style.backgroundColor = "#1E293B";
			tdHorario.style.borderBottom = "1px solid rgba(255,255,255,0.08)";
			tdHorario.style.borderRight = "1px solid rgba(255,255,255,0.15)";
			tdHorario.style.textAlign = "center";

			const hStart = i + 6 + (turno === 2 ? 6 : turno === 3 ? 11 : 0);
			const min = turno === 3 ? "30" : "00";
			tdHorario.textContent = `${hStart}:${min}-${hStart + 1}:${min}`;
			tr.appendChild(tdHorario);

			for (let j = 2; j <= 7; j++) {
				const turnoChar = turno === 1 ? "M" : turno === 2 ? "T" : "N";
				const cellId = `${j}${turnoChar}${i}`;
				const td = document.createElement("td");
				td.style.padding = "2px";
				td.style.borderBottom = "1px solid rgba(255,255,255,0.08)";
				if (j < 7) td.style.borderRight = "1px solid rgba(255,255,255,0.08)";
				td.style.backgroundColor = "#0F172A";
				td.style.height = "18px";
				td.style.boxSizing = "border-box";

				const sub = occMap.get(cellId);
				if (sub) {
					td.style.backgroundColor = sub.color;
					td.style.color = "#ffffff";
					td.style.fontWeight = "bold";
					td.style.fontSize = "9px";
					td.style.textAlign = "center";
					td.style.verticalAlign = "middle";
					td.style.lineHeight = "1.05";
					td.style.wordBreak = "break-word";
					td.style.textShadow = "0 1px 2px rgba(0,0,0,0.8)";
					td.textContent = sub.name;
				}

				tr.appendChild(td);
			}

			tbody.appendChild(tr);
		}
	}

	tableEl.appendChild(tbody);
	card.appendChild(tableEl);

	document.body.appendChild(card);

	try {
		const html2canvasFn = window.html2canvas || (typeof html2canvas !== "undefined" ? html2canvas : null);
		const jsPDFLib = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;

		if (html2canvasFn && jsPDFLib) {
			const canvas = await html2canvasFn(card, {
				scale: 2,
				useCORS: true,
				backgroundColor: "#0F172A",
				logging: false,
				onclone: (clonedDoc) => {
					const el = clonedDoc.getElementById("pdf_export_card");
					if (el) {
						el.style.opacity = "1";
						el.style.position = "static";
					}
				},
			});

			const imgData = canvas.toDataURL("image/jpeg", 0.98);
			const pdf = new jsPDFLib({
				orientation: "landscape",
				unit: "mm",
				format: "a4",
			});

			const pdfWidth = 297;
			const pdfHeight = 210;
			const margin = 8;
			const maxW = pdfWidth - margin * 2;
			const maxH = pdfHeight - margin * 2;

			const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
			const finalW = canvas.width * ratio;
			const finalH = canvas.height * ratio;

			const x = (pdfWidth - finalW) / 2;
			const y = (pdfHeight - finalH) / 2;

			pdf.addImage(imgData, "JPEG", x, y, finalW, finalH);
			pdf.save(`grade_horarios_ufrb_${new Date().toISOString().slice(0, 10)}.pdf`);
		} else if (typeof html2pdf !== "undefined") {
			const opt = {
				margin: [6, 6, 6, 6],
				filename: `grade_horarios_ufrb_${new Date().toISOString().slice(0, 10)}.pdf`,
				image: { type: "jpeg", quality: 0.98 },
				html2canvas: {
					scale: 2,
					useCORS: true,
					backgroundColor: "#0F172A",
					onclone: (clonedDoc) => {
						const el = clonedDoc.getElementById("pdf_export_card");
						if (el) {
							el.style.opacity = "1";
							el.style.position = "static";
						}
					},
				},
				jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
			};
			await html2pdf().set(opt).from(card).save();
		} else {
			window.print();
		}

		if (document.body.contains(card)) {
			document.body.removeChild(card);
		}
		setMessage("PDF baixado com sucesso!", "ok");
	} catch (err) {
		console.error("Erro no PDF:", err);
		if (document.body.contains(card)) {
			document.body.removeChild(card);
		}
		setMessage("Erro ao gerar o arquivo PDF.", "error");
	}
}
