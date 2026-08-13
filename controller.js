const STORAGE_KEY = "horarios.subjects.v1";

let table;
let nameInput;
let codeInput;
let addButton;
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

function colorDistance(hex1, hex2) {
	const [r1, g1, b1] = hexToRgb(hex1);
	const [r2, g2, b2] = hexToRgb(hex2);
	const dr = r1 - r2;
	const dg = g1 - g2;
	const db = b1 - b2;
	return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db);
}

function pickColorFor(usedColors, index) {
	const palette = [
		"#00C2FF", // Cyan / Azul Elétrico
		"#FF4D4F", // Vermelho Vivo
		"#49F17A", // Verde Limão / Neon
		"#FFB020", // Laranja / Âmbar
		"#A78BFA", // Roxo / Violeta
		"#FF5CCB", // Rosa Choque / Magenta
		"#2DD4BF", // Verde Água / Teal
		"#FFD400", // Amarelo Ouro
		"#3B82F6", // Azul Royal
		"#F97316", // Laranja Vivo
		"#10B981", // Verde Esmeralda
		"#EC4899", // Rosa Pink
		"#8B5CF6", // Roxo Escuro
		"#84CC16", // Verde Limão Escuro
		"#06B6D4", // Turquesa
		"#E11D48", // Vermelho Carmim
	];

	const available = palette.filter((c) => !usedColors.has(c));

	if (usedColors.size === 0) {
		return palette[0];
	}

	if (available.length > 0) {
		// Escolhe a cor disponível que tenha a MAIOR distância visual da cor mais próxima já utilizada
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

	// Se a paleta esgotar, gera tons HSL usando o Ângulo Áureo (137.5°) para máximo contraste
	const hue = Math.round((index * 137.5) % 360);
	return `hsl(${hue}, 85%, 60%)`;
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
