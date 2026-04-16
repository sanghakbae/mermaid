import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import mermaid from 'mermaid';

const DEFAULT_CODE = `flowchart TD
    A[요구사항 입력] --> B{구문 파싱}
    B -->|성공| C[Mermaid 렌더링]
    B -->|실패| D[에러 메시지 표시]
    C --> E[오른쪽 프리뷰 갱신]`;

const MERMAID_LANGUAGE_ID = 'mermaid';
const APP_TITLE = '머메이드 라이브 에디터';
const EXAMPLES = [
  {
    label: '흐름도',
    value: `flowchart TD
    A[시작] --> B{판단}
    B -->|예| C[결과]
    B -->|아니오| D[재시도]
    D --> A`,
  },
  {
    label: '순서도',
    value: `sequenceDiagram
    participant 사용자
    participant 앱
    사용자->>앱: 요청
    앱-->>사용자: 응답`,
  },
  {
    label: '클래스',
    value: `classDiagram
    class 동물 {
      +String 이름
      +소리내기()
    }
    동물 <|-- 개`,
  },
  {
    label: '상태',
    value: `stateDiagram-v2
    [*] --> 대기
    대기 --> 실행: 시작
    실행 --> [*]: 종료`,
  },
  {
    label: 'ER',
    value: `erDiagram
    고객 ||--o{ 주문 : 요청
    주문 ||--|{ 주문항목 : 포함`,
  },
  {
    label: '간트',
    value: `gantt
    title 프로젝트 계획
    dateFormat  YYYY-MM-DD
    section 디자인
    시안          :done,    des1, 2026-04-01, 3d
    제작          :active,  des2, 2026-04-04, 5d`,
  },
  {
    label: '마인드맵',
    value: `mindmap
  root((제품))
    디자인
      UI
      UX
    개발
      프런트엔드
      백엔드`,
  },
  {
    label: '여정',
    value: `journey
    title 사용자 여정
    section 발견
      검색: 5: 사용자
      비교: 3: 사용자
    section 결정
      구매: 1: 사용자`,
  },
  {
    label: '파이',
    value: `pie
    title 시간 배분
    "계획" : 30
    "디자인" : 20
    "코딩" : 50`,
  },
  {
    label: 'Git',
    value: `gitGraph
    commit
    branch 개발
    checkout 개발
    commit
    checkout main
    merge 개발`,
  },
  {
    label: '타임라인',
    value: `timeline
    title 출시 계획
    2026-04-01 : 시작
    2026-04-10 : 시제품
    2026-04-20 : 출시`,
  },
  {
    label: '칸반',
    value: `kanban
    할 일
      [아이디어]
      [명세]
    진행 중
      [구현]
    완료
      [배포]`,
  },
];

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'neutral',
  fontFamily: 'KoPubDotum, KoPub Dotum, -apple-system, BlinkMacSystemFont, sans-serif',
  fontSize: 12,
  themeCSS: `
    .nodeLabel,
    .label text,
    .label foreignObject,
    .label foreignObject div,
    .label foreignObject span,
    .cluster-label text,
    .cluster-label foreignObject,
    .cluster-label foreignObject div,
    .cluster-label foreignObject span {
      font-weight: 700 !important;
    }
  `,
  flowchart: {
    padding: 6,
  },
  class: {
    padding: 6,
  },
  state: {
    padding: 6,
    miniPadding: 4,
  },
  er: {
    entityPadding: 6,
  },
  architecture: {
    padding: 6,
  },
  mindmap: {
    padding: 6,
  },
  kanban: {
    padding: 6,
  },
});

function parseErrorLocation(errorMessage) {
  const lineMatch =
    errorMessage.match(/line\s+(\d+)/i) ??
    errorMessage.match(/on\s+line\s+(\d+)/i) ??
    errorMessage.match(/Parse error on line\s+(\d+)/i);
  const colMatch =
    errorMessage.match(/col(?:umn)?\s+(\d+)/i) ??
    errorMessage.match(/column\s+(\d+)/i);
  const line = lineMatch ? Number(lineMatch[1]) : null;
  const column = colMatch ? Number(colMatch[1]) : 1;

  return {
    line: Number.isNaN(line) || line === null ? null : Math.max(1, line),
    column: Number.isNaN(column) ? 1 : Math.max(1, column),
  };
}

function buildErrorGuide(errorMessage, location) {
  const lineLabel = location.line ? `${location.line}번째 줄을 먼저 확인하세요.` : '오류 위치를 특정하지 못했습니다.';

  if (/expect/i.test(errorMessage)) {
    return `${lineLabel} Mermaid 문법 토큰이 빠졌거나 순서가 맞지 않습니다. 화살표, 대괄호, 중괄호, 따옴표 쌍을 점검하세요.`;
  }

  if (/lexical|unrecognized|unexpected/i.test(errorMessage)) {
    return `${lineLabel} 지원되지 않는 문자나 잘못된 키워드가 들어갔을 가능성이 큽니다. 다이어그램 선언부와 특수문자를 확인하세요.`;
  }

  return `${lineLabel} 선언 키워드와 괄호/화살표 구문을 다시 확인하세요.`;
}

function detectDiagramType(code) {
  const normalized = code.trimStart();

  const patterns = [
    ['flowchart', /^flowchart\b|^graph\b/i],
    ['sequenceDiagram', /^sequenceDiagram\b/i],
    ['classDiagram', /^classDiagram\b/i],
    ['stateDiagram', /^stateDiagram(?:-v2)?\b/i],
    ['erDiagram', /^erDiagram\b/i],
    ['gantt', /^gantt\b/i],
    ['mindmap', /^mindmap\b/i],
    ['journey', /^journey\b/i],
    ['pie', /^pie\b/i],
    ['timeline', /^timeline\b/i],
    ['gitGraph', /^gitGraph\b/i],
    ['quadrantChart', /^quadrantChart\b/i],
    ['requirementDiagram', /^requirementDiagram\b/i],
    ['xychart', /^xychart-beta\b/i],
    ['architecture', /^architecture\b/i],
    ['kanban', /^kanban\b/i],
    ['block', /^block-beta\b/i],
    ['packet', /^packet-beta\b/i],
    ['radar', /^radar-beta\b/i],
    ['sankey', /^sankey-beta\b/i],
  ];

  for (const [type, pattern] of patterns) {
    if (pattern.test(normalized)) {
      return type;
    }
  }

  return 'unknown';
}

function getGuideCopy(diagramType) {
  if (diagramType === 'unknown') {
    return '문법을 자동 감지하지 못했습니다. 첫 줄의 다이어그램 선언을 확인하거나 예제를 불러오세요.';
  }

  return `현재 감지된 타입: ${diagramType}`;
}

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function normalizeMermaidSpacing(line) {
  return line
    .replace(/\s*-->\s*/g, ' --> ')
    .replace(/\s*-.->\s*/g, ' -.-> ')
    .replace(/\s*==>\s*/g, ' ==> ')
    .replace(/\s*\|\s*/g, '|')
    .replace(/\s*:\s*/g, ' : ')
    .replace(/\s+/g, ' ')
    .replace(/\s+\|/g, ' |')
    .replace(/\|\s+/g, '|')
    .trim();
}

function formatFlowchartCode(code) {
  const lines = code.replace(/\r\n/g, '\n').split('\n');
  const formatted = [];
  let indent = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      if (formatted.at(-1) !== '') {
        formatted.push('');
      }
      continue;
    }

    const normalized = normalizeMermaidSpacing(line);
    const lower = normalized.toLowerCase();
    const dedentBefore = lower === 'end' || lower === 'else' || lower === 'and';
    const indentAfter = /^subgraph\b|^loop\b|^alt\b|^opt\b|^par\b|^critical\b|^rect\b|^case\b|^switch\b|^box\b|^state\b/i.test(
      normalized,
    );

    if (dedentBefore) {
      indent = Math.max(0, indent - 1);
    }

    formatted.push(`${'  '.repeat(indent)}${normalized}`);

    if (indentAfter) {
      indent += 1;
    }
  }

  return formatted.join('\n').trim();
}

function formatSequenceCode(code) {
  const lines = code.replace(/\r\n/g, '\n').split('\n');
  const formatted = [];
  let indent = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      if (formatted.at(-1) !== '') {
        formatted.push('');
      }
      continue;
    }

    const normalized = line
      .replace(/\s*->>\s*/g, ' ->> ')
      .replace(/\s*-->>\s*/g, ' -->> ')
      .replace(/\s*->\s*/g, ' -> ')
      .replace(/\s*-->\s*/g, ' --> ')
      .replace(/\s*:\s*/g, ' : ')
      .replace(/\s+/g, ' ')
      .trim();

    if (/^(autonumber|loop\b|alt\b|opt\b|par\b|critical\b|rect\b|note\b|participant\b|actor\b|box\b)/i.test(normalized)) {
      formatted.push(`${'  '.repeat(indent)}${normalized}`);
      if (/^(loop|alt|opt|par|critical|rect|box)\b/i.test(normalized)) {
        indent += 1;
      }
      continue;
    }

    if (/^(end|else\b|and\b)$/i.test(normalized)) {
      indent = Math.max(0, indent - 1);
    }

    formatted.push(`${'  '.repeat(indent)}${normalized}`);
  }

  return formatted.join('\n').trim();
}

function formatBlockCode(code) {
  const lines = code.replace(/\r\n/g, '\n').split('\n');
  const formatted = [];
  let indent = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      if (formatted.at(-1) !== '') {
        formatted.push('');
      }
      continue;
    }

    const normalized = normalizeMermaidSpacing(line);
    const lower = normalized.toLowerCase();

    if (lower === 'end' || lower === 'else' || lower === 'and') {
      indent = Math.max(0, indent - 1);
    }

    formatted.push(`${'  '.repeat(indent)}${normalized}`);

    if (
      /^(subgraph|loop|alt|opt|par|critical|rect|case|switch|box|state)\b/i.test(normalized) ||
      /{$/.test(normalized)
    ) {
      indent += 1;
    }
  }

  return formatted.join('\n').trim();
}

function formatMermaidCode(code) {
  const diagramType = detectDiagramType(code);

  switch (diagramType) {
    case 'flowchart':
      return formatFlowchartCode(code);
    case 'sequenceDiagram':
      return formatSequenceCode(code);
    case 'classDiagram':
    case 'stateDiagram':
    case 'architecture':
    case 'kanban':
      return formatBlockCode(code);
    case 'gantt':
    case 'journey':
    case 'pie':
    case 'timeline':
    case 'gitGraph':
    case 'mindmap':
    case 'erDiagram':
    case 'quadrantChart':
    case 'requirementDiagram':
    case 'xychart':
    case 'block':
    case 'packet':
    case 'radar':
    case 'sankey':
      return code.replace(/\r\n/g, '\n').split('\n').map((line) => line.trimEnd()).join('\n').trim();
    default:
      return formatBlockCode(code);
  }
}

async function createPngBlobFromSvg(svgContent) {
  const transparentSvg = fitSvgToContent(makeTransparentSvg(svgContent));
  const { width, height } = getSvgExportMetrics(transparentSvg);
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(transparentSvg)}`;
  const image = new Image();

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
    image.src = svgUrl;
  });

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('PNG 변환용 캔버스를 만들지 못했습니다.');
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(scale, scale);
  ctx.drawImage(image, 0, 0, width, height);

  const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

  if (!pngBlob) {
    throw new Error('PNG 변환에 실패했습니다.');
  }

  if (pngBlob.size === 0) {
    throw new Error('PNG 파일이 비어 있습니다.');
  }

  return pngBlob;
}

function makeTransparentSvg(svgText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = doc.documentElement;

  svg.removeAttribute('style');
  svg.style.backgroundColor = 'transparent';

  for (const node of svg.querySelectorAll('rect')) {
    const fill = node.getAttribute('fill');
    const width = node.getAttribute('width');
    const height = node.getAttribute('height');
    const canvasLike =
      (width === '100%' && height === '100%') ||
      node.getAttribute('x') === '0' ||
      node.classList.contains('background');

    if (canvasLike && fill && /^(#fff(?:fff)?|white|rgb\(255,\s*255,\s*255\))$/i.test(fill)) {
      node.setAttribute('fill', 'transparent');
      node.setAttribute('fill-opacity', '0');
    }
  }

  return new XMLSerializer().serializeToString(doc);
}

function fitSvgToContent(svgText, padding = 0) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = doc.documentElement;
  const sandbox = document.createElement('div');

  sandbox.style.position = 'fixed';
  sandbox.style.left = '-10000px';
  sandbox.style.top = '-10000px';
  sandbox.style.pointerEvents = 'none';
  sandbox.style.opacity = '0';

  const measuredSvg = document.importNode(svg, true);
  sandbox.appendChild(measuredSvg);
  document.body.appendChild(sandbox);

  try {
    const bbox = measuredSvg.getBBox();

    if (bbox.width > 0 && bbox.height > 0) {
      const x = bbox.x - padding;
      const y = bbox.y - padding;
      const width = bbox.width + padding * 2;
      const height = bbox.height + padding * 2;

      measuredSvg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
      measuredSvg.setAttribute('width', `${width}`);
      measuredSvg.setAttribute('height', `${height}`);
      measuredSvg.removeAttribute('style');
      measuredSvg.style.backgroundColor = 'transparent';
    }

    return new XMLSerializer().serializeToString(measuredSvg);
  } finally {
    document.body.removeChild(sandbox);
  }
}

function getSvgExportMetrics(svgText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = doc.documentElement;
  const viewBox = svg.getAttribute('viewBox');
  const widthAttr = Number.parseFloat(svg.getAttribute('width') ?? '');
  const heightAttr = Number.parseFloat(svg.getAttribute('height') ?? '');

  if (viewBox) {
    const parts = viewBox
      .trim()
      .split(/[\s,]+/)
      .map((value) => Number.parseFloat(value));

    if (parts.length === 4 && parts.every((value) => Number.isFinite(value))) {
      return {
        width: Math.max(1, Math.ceil(parts[2])),
        height: Math.max(1, Math.ceil(parts[3])),
      };
    }
  }

  return {
    width: Number.isFinite(widthAttr) && widthAttr > 0 ? Math.ceil(widthAttr) : 1200,
    height: Number.isFinite(heightAttr) && heightAttr > 0 ? Math.ceil(heightAttr) : 800,
  };
}

function createDownloadTarget(filename) {
  return {
    kind: 'download',
    filename,
  };
}

async function saveBlob(target, blob, filename) {
  if (typeof navigator !== 'undefined' && 'msSaveOrOpenBlob' in navigator) {
    navigator.msSaveOrOpenBlob(blob, filename);
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(link);
  }, 3000);
}

function makeClipboardItem(blob) {
  if (typeof window === 'undefined' || typeof window.ClipboardItem === 'undefined') {
    return null;
  }

  return new ClipboardItem({ [blob.type]: blob });
}

function readSharedCodeFromLocation() {
  if (typeof window === 'undefined') {
    return '';
  }

  const url = new URL(window.location.href);
  const hashValue = url.hash.replace(/^#c=/, '');
  const queryValue = url.searchParams.get('code');

  if (hashValue) {
    try {
      return fromBase64Url(hashValue);
    } catch {
      return '';
    }
  }

  if (queryValue) {
    return queryValue;
  }

  return '';
}

function writeSharedCodeToLocation(code) {
  const url = new URL(window.location.href);
  url.hash = `c=${toBase64Url(code)}`;
  url.searchParams.delete('code');
  window.history.replaceState({}, '', url.toString());
}

function collectEditableGroups(root) {
  return Array.from(root.querySelectorAll('g.edgeLabel, g.node, g.cluster, g.actor, g.note'));
}

function findBestLabelNode(element) {
  const foreignNodes = element.querySelectorAll(
    'g.label foreignObject span, g.label foreignObject div, g.nodeLabel foreignObject span, g.nodeLabel foreignObject div, .cluster-label foreignObject span, .cluster-label foreignObject div, foreignObject span, foreignObject div',
  );

  if (foreignNodes.length > 0) {
    return foreignNodes[foreignNodes.length - 1];
  }

  const textCandidates = element.querySelectorAll(
    'g.label text, g.nodeLabel text, .cluster-label text, text',
  );

  return textCandidates[textCandidates.length - 1] ?? null;
}

function getTextFromLabelElement(element) {
  const labelNode = findBestLabelNode(element);

  if (!labelNode) {
    return '';
  }

  if (labelNode.tagName.toLowerCase() !== 'text') {
    return labelNode.textContent?.trim() ?? '';
  }

  const tspans = labelNode.querySelectorAll('tspan');

  if (tspans.length > 0) {
    return Array.from(tspans)
      .map((node) => node.textContent ?? '')
      .join('\n')
      .trim();
  }

  return labelNode.textContent?.trim() ?? '';
}

function applyTextToLabelElement(element, nextText) {
  const lines = nextText.split('\n');
  const labelNode = findBestLabelNode(element);

  if (!labelNode) {
    return;
  }

  const ownerDocument = labelNode.ownerDocument;

  if (labelNode.tagName.toLowerCase() !== 'text') {
    labelNode.textContent = nextText;
    return;
  }

  const x = labelNode.getAttribute('x') ?? '0';
  labelNode.replaceChildren();

  lines.forEach((line, index) => {
    const tspan = ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    tspan.setAttribute('x', x);
    if (index > 0) {
      tspan.setAttribute('dy', '1.2em');
    }
    tspan.textContent = line;
    labelNode.appendChild(tspan);
  });
}

function findEditableLabelTarget(target) {
  const primaryTarget = target.closest('g.edgeLabel, g.node, g.cluster, g.actor, g.note');

  if (primaryTarget) {
    return primaryTarget;
  }

  const labelTarget = target.closest('g.nodeLabel, g.label, g[class*="label"]');

  if (!labelTarget) {
    return null;
  }

  return (
    labelTarget.closest('g.node, g.cluster, g.edgeLabel, g.actor, g.note') ??
    labelTarget
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceNodeLabelInCode(code, currentText, nextLabel) {
  const escapedText = escapeRegExp(currentText);
  const patterns = [
    { regex: new RegExp(`\\[\\[${escapedText}\\]\\]`), replace: `[[${nextLabel}]]` },
    { regex: new RegExp(`\\(\\(${escapedText}\\)\\)`), replace: `((${nextLabel}))` },
    { regex: new RegExp(`\\{\\{${escapedText}\\}\\}`), replace: `{{${nextLabel}}}` },
    { regex: new RegExp(`\\(\\[${escapedText}\\]\\)`), replace: `([${nextLabel}])` },
    { regex: new RegExp(`\\[\\(${escapedText}\\)\\]`), replace: `[(${nextLabel})]` },
    { regex: new RegExp(`\\[${escapedText}\\]`), replace: `[${nextLabel}]` },
    { regex: new RegExp(`\\(${escapedText}\\)`), replace: `(${nextLabel})` },
    { regex: new RegExp(`\\{${escapedText}\\}`), replace: `{${nextLabel}}` },
  ];

  for (const pattern of patterns) {
    if (pattern.regex.test(code)) {
      return code.replace(pattern.regex, pattern.replace);
    }
  }

  return code;
}

function replaceEdgeLabelInCode(code, currentText, nextLabel) {
  const escapedText = escapeRegExp(currentText);
  return code.replace(new RegExp(`\\|${escapedText}\\|`), `|${nextLabel}|`);
}

function getSelectionMeta(target, labelText) {
  if (target.matches('g.edgeLabel') || target.closest('g.edgeLabel')) {
    return {
      kind: 'edgeLabel',
      currentText: labelText,
    };
  }

  const nodeGroup = target.closest('g.node, g.cluster, g.actor, g.note');

  if (nodeGroup) {
    return {
      kind: 'node',
      currentText: labelText,
    };
  }

  return null;
}

function clearSelectedElementStyles(element) {
  if (!element) {
    return;
  }

  element.classList.remove('preview-selected-target');

  for (const node of element.querySelectorAll('*')) {
    node.style.removeProperty('stroke');
    node.style.removeProperty('stroke-width');
    node.style.removeProperty('fill');
    node.style.removeProperty('fill-opacity');
    node.style.removeProperty('color');
    node.style.removeProperty('font-weight');
    node.style.removeProperty('filter');
  }
}

function applySelectedElementStyles(element) {
  if (!element) {
    return;
  }

  element.classList.add('preview-selected-target');

  for (const node of element.querySelectorAll('rect, path, polygon, circle, ellipse')) {
    node.style.setProperty('stroke', '#dc2626', 'important');
    node.style.setProperty('stroke-width', '2px', 'important');
    node.style.setProperty('filter', 'drop-shadow(0 0 2px rgba(220,38,38,0.25))', 'important');
  }

  for (const node of element.querySelectorAll('rect.label-container, .labelBkg')) {
    node.style.setProperty('fill', '#fee2e2', 'important');
    node.style.setProperty('fill-opacity', '1', 'important');
    node.style.setProperty('stroke', '#dc2626', 'important');
  }

  for (const node of element.querySelectorAll('text, tspan, foreignObject, span, div')) {
    node.style.setProperty('fill', '#991b1b', 'important');
    node.style.setProperty('color', '#991b1b', 'important');
    node.style.setProperty('font-weight', '700', 'important');
  }
}

function registerMermaidLanguage(monaco) {
  if (monaco.languages.getLanguages().some((language) => language.id === MERMAID_LANGUAGE_ID)) {
    return;
  }

  monaco.languages.register({ id: MERMAID_LANGUAGE_ID });
  monaco.languages.setMonarchTokensProvider(MERMAID_LANGUAGE_ID, {
    tokenizer: {
      root: [
        [/%%.*$/, 'comment'],
        [
          /\b(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|quadrantChart|requirementDiagram|xychart-beta|architecture|kanban|block-beta|packet-beta|radar-beta|sankey-beta)\b/,
          'keyword.directive',
        ],
        [
          /\b(subgraph|end|participant|actor|activate|deactivate|loop|alt|opt|par|and|else|critical|option|break|rect|note|title|section|accTitle|accDescr|classDef|class|style|linkStyle|click)\b/,
          'keyword',
        ],
        [/"[^"]*"|'[^']*'/, 'string'],
        [/\|[^|]+\|/, 'string.escape'],
        [/-->|---|==>|-.->|==|--|\.\.\.|~~>|o--o|x--x|o--|--o|x--|--x/, 'operators'],
        [/[\[\]{}()<>]/, 'delimiter.bracket'],
        [/\b\d+(?:\.\d+)?\b/, 'number'],
      ],
    },
  });
}

function MermaidPreview({ code, zoom, onErrorChange, onSvgChange, onApplySelection }) {
  const [svg, setSvg] = useState('');
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [draftText, setDraftText] = useState('');
  const [modalPosition, setModalPosition] = useState(null);
  const renderId = useId().replace(/:/g, '-');
  const canvasRef = useRef(null);
  const svgHostRef = useRef(null);
  const selectedElementRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      try {
        const valid = await mermaid.parse(code, { suppressErrors: false });

        if (!valid) {
          return;
        }

        const { svg: nextSvg } = await mermaid.render(`mermaid-${renderId}`, code);

        if (!cancelled) {
          setSvg(nextSvg);
          onErrorChange('');
          onSvgChange(nextSvg);
          setSelectedTarget(null);
          setDraftText('');
          setModalPosition(null);
          clearSelectedElementStyles(selectedElementRef.current);
          selectedElementRef.current = null;
        }
      } catch (err) {
        if (!cancelled) {
          const nextError = err instanceof Error ? err.message : '다이어그램을 렌더링하지 못했습니다.';
          onErrorChange(nextError);
          onSvgChange('');
        }
      }
    }

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [code, onErrorChange, onSvgChange, renderId]);

  function handleCanvasClick(event) {
    if (!svgHostRef.current || !canvasRef.current) {
      return;
    }

    if (event.target.closest('.preview-modal')) {
      return;
    }

    const target = findEditableLabelTarget(event.target);

    if (!target || !svgHostRef.current.contains(target)) {
      setSelectedTarget(null);
      clearSelectedElementStyles(selectedElementRef.current);
      selectedElementRef.current = null;
      setModalPosition(null);
      return;
    }

    const labelText = getTextFromLabelElement(target);

    if (!labelText) {
      return;
    }

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    clearSelectedElementStyles(selectedElementRef.current);
    target.setAttribute('data-edit-target', 'active-selection');
    applySelectedElementStyles(target);
    selectedElementRef.current = target;
    setSelectedTarget(getSelectionMeta(target, labelText));
    setDraftText(labelText);
    setModalPosition({
      left: targetRect.left - canvasRect.left + canvasRef.current.scrollLeft,
      top: targetRect.bottom - canvasRect.top + canvasRef.current.scrollTop + 10,
    });
  }

  function handleApplyEdit() {
    if (!selectedTarget) {
      return;
    }

    const applied = onApplySelection(selectedTarget, draftText);

    if (!applied && selectedElementRef.current && svgHostRef.current) {
      applyTextToLabelElement(selectedElementRef.current, draftText);
      const svgElement = svgHostRef.current.querySelector('svg');

      if (svgElement) {
        const nextSvg = new XMLSerializer().serializeToString(svgElement);
        setSvg(nextSvg);
        onSvgChange(nextSvg);
      }
    }

    clearSelectedElementStyles(selectedElementRef.current);
    selectedElementRef.current?.removeAttribute('data-edit-target');
    selectedElementRef.current = null;
    setSelectedTarget(null);
    setModalPosition(null);
  }

  function handleDraftKeyDown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      handleApplyEdit();
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setSelectedTarget(null);
      clearSelectedElementStyles(selectedElementRef.current);
      selectedElementRef.current?.removeAttribute('data-edit-target');
      selectedElementRef.current = null;
      setModalPosition(null);
    }
  }

  if (!svg) {
    return (
      <div className="preview-state">
        <p className="preview-state-label">미리보기</p>
      </div>
    );
  }

  return (
    <div ref={canvasRef} className="mermaid-output interactive-preview" onClick={handleCanvasClick}>
      <div
        ref={svgHostRef}
        className="mermaid-scale"
        style={{ transform: `scale(${zoom})` }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {selectedTarget && modalPosition ? (
        <div
          className="preview-modal"
          style={{
            left: modalPosition.left,
            top: modalPosition.top,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <p className="preview-modal-title">라벨 수정</p>
          <textarea
            className="preview-textarea"
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            onKeyDown={handleDraftKeyDown}
          />
          <div className="preview-text-editor-actions">
            <button type="button" className="preview-edit-button" onClick={handleApplyEdit}>
              Apply
            </button>
            <button
              type="button"
              className="preview-edit-button secondary"
              onClick={() => {
                setSelectedTarget(null);
                clearSelectedElementStyles(selectedElementRef.current);
                selectedElementRef.current?.removeAttribute('data-edit-target');
                selectedElementRef.current = null;
                setModalPosition(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  const [code, setCode] = useState(() => readSharedCodeFromLocation() || DEFAULT_CODE);
  const [zoom, setZoom] = useState(1);
  const [codeFontSize, setCodeFontSize] = useState(12);
  const [splitRatio, setSplitRatio] = useState(30);
  const [isMobileClient, setIsMobileClient] = useState(false);
  const [parseError, setParseError] = useState('');
  const [svgContent, setSvgContent] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [shareError, setShareError] = useState('');
  const [selectedExample, setSelectedExample] = useState('custom');
  const [frozenSvgContent, setFrozenSvgContent] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const workspaceRef = useRef(null);
  const isResizingRef = useRef(false);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationIdsRef = useRef([]);
  const hasMountedRef = useRef(false);
  const errorLocation = useMemo(() => parseErrorLocation(parseError), [parseError]);
  const diagramType = useMemo(() => detectDiagramType(code), [code]);
  const guideCopy = useMemo(() => getGuideCopy(diagramType), [diagramType]);
  const errorGuide = useMemo(
    () => buildErrorGuide(parseError, errorLocation),
    [errorLocation, parseError],
  );
  const shareLink = useMemo(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    const url = new URL(window.location.href);
    url.hash = `c=${toBase64Url(code)}`;
    url.searchParams.delete('code');
    return url.toString();
  }, [code]);

  function updateSplitRatio(nextRatio) {
    setSplitRatio(Math.min(80, Math.max(20, Number(nextRatio.toFixed(1)))));
  }

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    writeSharedCodeToLocation(code);
  }, [code]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 960px), (pointer: coarse)');

    function handleClientChange(event) {
      setIsMobileClient(event.matches);
    }

    setIsMobileClient(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleClientChange);

    return () => {
      mediaQuery.removeEventListener('change', handleClientChange);
    };
  }, []);

  function handlePreviewSelectionApply(selection, nextText) {
    if (!selection) {
      return false;
    }

    if (selection.kind === 'node' && selection.currentText) {
      const nextCode = replaceNodeLabelInCode(code, selection.currentText, nextText);

      if (nextCode !== code) {
        setCode(nextCode);
        setSelectedExample('custom');
        return true;
      }
    }

    if (selection.kind === 'edgeLabel' && selection.currentText) {
      const nextCode = replaceEdgeLabelInCode(code, selection.currentText, nextText);

      if (nextCode !== code) {
        setCode(nextCode);
        setSelectedExample('custom');
        return true;
      }
    }

    return false;
  }

  function handleExampleChange(nextValue) {
    setSelectedExample(nextValue);

    if (nextValue === 'custom') {
      return;
    }

    const example = EXAMPLES.find((item) => item.label === nextValue);

    if (example) {
      setCode(example.value);
      setShareError('');
    }
  }

  function handleFormatCode() {
    setCode((currentCode) => formatMermaidCode(currentCode));
    setSelectedExample('custom');
  }

  async function handleShareLink() {
    try {
      await navigator.clipboard.writeText(shareLink);
      setShareError('');
    } catch {
      setShareError('공유 링크 복사에 실패했습니다. 브라우저 권한을 확인하세요.');
    }
  }

  function handleJumpToError() {
    if (!errorLocation.line || !editorRef.current) {
      return;
    }

    editorRef.current.revealLineInCenter(errorLocation.line);
    editorRef.current.setPosition({ lineNumber: errorLocation.line, column: errorLocation.column });
    editorRef.current.focus();
  }

  useEffect(() => {
    if (!monacoRef.current || !editorRef.current) {
      return;
    }

    const monaco = monacoRef.current;
    const model = editorRef.current.getModel();

    if (!model) {
      return;
    }

    if (!parseError) {
      monaco.editor.setModelMarkers(model, MERMAID_LANGUAGE_ID, []);
      decorationIdsRef.current = editorRef.current.deltaDecorations(decorationIdsRef.current, []);
      return;
    }

    const lineCount = model.getLineCount();
    const lineNumber = errorLocation.line ? Math.min(errorLocation.line, lineCount) : 1;
    const lineLength = model.getLineLength(lineNumber);
    const startColumn = Math.min(errorLocation.column, Math.max(lineLength, 1));
    const endColumn = Math.max(startColumn + 1, lineLength + 1);

    monaco.editor.setModelMarkers(model, MERMAID_LANGUAGE_ID, [
      {
        startLineNumber: lineNumber,
        startColumn,
        endLineNumber: lineNumber,
        endColumn,
        message: parseError,
        severity: monaco.MarkerSeverity.Error,
      },
    ]);

    decorationIdsRef.current = editorRef.current.deltaDecorations(decorationIdsRef.current, [
      {
        range: new monaco.Range(lineNumber, 1, lineNumber, lineLength + 1),
        options: {
          className: 'monaco-error-inline',
          isWholeLine: true,
        },
      },
    ]);
  }, [errorLocation, parseError]);

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;
  }

  function handleEditorWillMount(monaco) {
    registerMermaidLanguage(monaco);
    monaco.editor.defineTheme('mermaidClean', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '94A3B8' },
        { token: 'keyword.directive', foreground: '2563EB', fontStyle: 'bold' },
        { token: 'keyword', foreground: '0F766E' },
        { token: 'string', foreground: 'B45309' },
        { token: 'string.escape', foreground: '7C3AED' },
        { token: 'operators', foreground: '7C3AED' },
        { token: 'delimiter.bracket', foreground: '475569' },
        { token: 'number', foreground: 'BE123C' },
      ],
      colors: {
        'editor.background': '#00000000',
        'editor.lineHighlightBackground': '#fef3c7',
        'editor.lineHighlightBorder': '#00000000',
        'editorLineNumber.foreground': '#94a3b8',
        'editorLineNumber.activeForeground': '#475569',
        'editorGutter.background': '#00000000',
        'editor.rangeHighlightBackground': '#00000000',
        'editor.rangeHighlightBorder': '#00000000',
        'editor.selectionBackground': '#cbd5e166',
        'editorCursor.foreground': '#0f172a',
        'scrollbar.shadow': '#00000000',
        'scrollbarSlider.background': '#cbd5e199',
        'scrollbarSlider.hoverBackground': '#94a3b8aa',
        'scrollbarSlider.activeBackground': '#64748baa',
      },
    });
  }

  function updateZoom(delta) {
    setZoom((currentZoom) => {
      const nextZoom = currentZoom + delta;
      return Math.min(5, Math.max(0.3, Number(nextZoom.toFixed(2))));
    });
  }

  function updateCodeZoom(delta) {
    setCodeFontSize((currentSize) => {
      const nextSize = currentSize + delta;
      return Math.min(28, Math.max(9, Number(nextSize.toFixed(1))));
    });
  }

  function handlePreviewWheel(event) {
    const isZoomGesture = event.altKey || event.ctrlKey || event.metaKey;

    if (!isZoomGesture) {
      return;
    }

    event.preventDefault();
    updateZoom(event.deltaY < 0 ? 0.1 : -0.1);
  }

  function handleCodeWheel(event) {
    const isZoomGesture = event.altKey || event.ctrlKey || event.metaKey;

    if (!isZoomGesture) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    updateCodeZoom(event.deltaY < 0 ? 1 : -1);
  }

  function handleResizeStart() {
    isResizingRef.current = true;
    document.body.classList.add('is-resizing-panels');
  }

  useEffect(() => {
    function handleResizeMove(event) {
      if (isMobileClient || !isResizingRef.current || !workspaceRef.current) {
        return;
      }

      const rect = workspaceRef.current.getBoundingClientRect();
      const nextRatio = ((event.clientX - rect.left) / rect.width) * 100;
      updateSplitRatio(nextRatio);
    }

    function handleResizeEnd() {
      if (!isResizingRef.current) {
        return;
      }

      isResizingRef.current = false;
      document.body.classList.remove('is-resizing-panels');
    }

    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);

    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
      document.body.classList.remove('is-resizing-panels');
    };
  }, [isMobileClient]);

  async function handleDownloadPng() {
    if (!svgContent) {
      return;
    }

    try {
      const saveTarget = createDownloadTarget('mermaid-diagram.png');
      const pngBlob = await createPngBlobFromSvg(svgContent);
      await saveBlob(saveTarget, pngBlob, 'mermaid-diagram.png');
      setDownloadError('');
    } catch (error) {
      if (error?.name === 'AbortError') {
        return;
      }

      setDownloadError('PNG 생성 또는 다운로드에 실패했습니다.');
    }
  }

  async function handleDownloadCode() {
    try {
      const saveTarget = createDownloadTarget('mermaid-diagram.mmd');
      const codeBlob = new Blob([code], { type: 'text/plain;charset=utf-8' });
      await saveBlob(saveTarget, codeBlob, 'mermaid-diagram.mmd');
      setDownloadError('');
    } catch (error) {
      if (error?.name === 'AbortError') {
        return;
      }

      setDownloadError('MMD 생성 또는 다운로드에 실패했습니다.');
    }
  }

  async function handleCopyPng() {
    if (!svgContent) {
      return;
    }

    try {
      const pngBlob = await createPngBlobFromSvg(svgContent);
      const clipboardItem = makeClipboardItem(pngBlob);

      if (!clipboardItem || !navigator.clipboard?.write) {
        throw new Error('clipboard-unavailable');
      }

      await navigator.clipboard.write([clipboardItem]);
      setDownloadError('');
    } catch {
      setDownloadError('PNG를 클립보드에 복사하지 못했습니다. 브라우저 권한을 확인하세요.');
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <p className="eyebrow">{APP_TITLE}</p>
          <label className="toolbar-field toolbar-field-inline">
            <span>문법 예시</span>
            <select
              className="toolbar-select"
              value={selectedExample}
              onChange={(event) => handleExampleChange(event.target.value)}
            >
              <option value="custom">사용자 지정</option>
              {EXAMPLES.map((example) => (
                <option key={example.label} value={example.label}>
                  {example.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <section ref={workspaceRef} className={`workspace ${isMobileClient ? 'is-mobile-client' : ''}`}>
        <section className="left-stack" style={isMobileClient ? undefined : { flexBasis: `${splitRatio}%` }}>
          <article className="panel editor-panel">
            <div className="panel-header">
              <h2>Code</h2>
            </div>
            <div
              className="editor-shell"
              onWheelCapture={handleCodeWheel}
              title="Alt/Option, Ctrl, Cmd + scroll로 코드 확대/축소"
            >
              <Editor
                beforeMount={handleEditorWillMount}
                className="monaco-editor-root"
                defaultLanguage={MERMAID_LANGUAGE_ID}
                language={MERMAID_LANGUAGE_ID}
                onChange={(value) => {
                  setCode(value ?? '');
                  setSelectedExample('custom');
                }}
                onMount={handleEditorDidMount}
                theme="mermaidClean"
                value={code}
                options={{
                  automaticLayout: true,
                  fontFamily: 'KoPubDotum, KoPub Dotum, monospace',
                  fontSize: codeFontSize,
                  lineHeight: Math.round(codeFontSize * 1.3),
                  lineNumbersMinChars: 1,
                  lineDecorationsWidth: 0,
                  minimap: { enabled: false },
                  overviewRulerBorder: false,
                  padding: { top: 24, bottom: 24 },
                  glyphMargin: false,
                  mouseWheelZoom: false,
                  renderLineHighlight: 'line',
                  roundedSelection: false,
                  scrollBeyondLastLine: false,
                  scrollbar: {
                    alwaysConsumeMouseWheel: false,
                    horizontal: 'auto',
                    useShadows: false,
                    vertical: 'auto',
                    verticalScrollbarSize: 10,
                  },
                  wordWrap: 'on',
                }}
              />
            </div>
          </article>

          <article className={`panel guide-panel ${parseError ? 'editor-guide-error' : ''}`}>
            <div className="panel-header">
              <h2>{parseError ? 'Syntax Guide' : 'Guide'}</h2>
              <span>{guideCopy}</span>
            </div>
            <div className="editor-guide">
              {parseError ? (
                <>
                  <p className="editor-guide-copy">{errorGuide}</p>
                  <pre className="editor-guide-error-text">{parseError}</pre>
                  {errorLocation.line ? (
                    <button type="button" className="guide-action" onClick={handleJumpToError}>
                      Go to line {errorLocation.line}
                    </button>
                  ) : null}
                </>
              ) : downloadError ? (
                <pre className="editor-guide-error-text">{downloadError}</pre>
              ) : shareError ? (
                <pre className="editor-guide-error-text">{shareError}</pre>
              ) : (
                <>
                  <p className="editor-guide-copy">{guideCopy}</p>
                  <p className="editor-guide-copy">
                    현재 화면 기준으로 PNG와 MMD를 각각 내려받습니다. 공유 링크는 코드 전체를 URL에 담습니다.
                  </p>
                </>
              )}
            </div>
          </article>
        </section>

        {!isMobileClient ? (
          <div
            className="panel-resizer"
            onMouseDown={handleResizeStart}
            role="separator"
            aria-orientation="vertical"
            aria-label="패널 너비 조절"
          />
        ) : null}

        <article className="panel preview-panel" style={isMobileClient ? undefined : { flexBasis: `${100 - splitRatio}%` }}>
          <div className="panel-header">
            <h2>Preview</h2>
            <div className="preview-toolbar">
              <button
                type="button"
                className="download-button"
                onClick={handleCopyPng}
                disabled={!svgContent}
              >
                PNG 복사
              </button>
              <button
                type="button"
                className="download-button"
                onClick={handleDownloadPng}
                disabled={!svgContent}
              >
                PNG 내려받기
              </button>
              <button
                type="button"
                className="download-button"
                onClick={handleDownloadCode}
              >
                MMD 내려받기
              </button>
              <button
                type="button"
                className={`download-button compare-toggle ${compareMode ? 'is-active' : ''}`}
                aria-pressed={compareMode}
                onClick={() => {
                  if (!compareMode && !frozenSvgContent && svgContent) {
                    setFrozenSvgContent(svgContent);
                  }
                  setCompareMode((current) => !current);
                }}
                disabled={!frozenSvgContent && !svgContent}
              >
                비교 모드
              </button>
              <button type="button" className="download-button" onClick={handleShareLink}>
                공유 링크
              </button>
              <button
                type="button"
                className="zoom-button"
                onClick={() => updateZoom(-0.1)}
                aria-label="축소"
              >
                -
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                className="zoom-button"
                onClick={() => updateZoom(0.1)}
                aria-label="확대"
              >
                +
              </button>
            </div>
          </div>
          <div
            className="preview-canvas"
            onWheel={handlePreviewWheel}
            title="Alt/Option, Ctrl, Cmd + scroll로 확대/축소"
          >
            {compareMode && frozenSvgContent ? (
              <div className="preview-compare-grid">
                <section className="preview-compare-pane">
                  <div className="preview-compare-label">고정본</div>
                  <div className="mermaid-output">
                    <div
                      className="mermaid-scale"
                      style={{ transform: `scale(${zoom})` }}
                      dangerouslySetInnerHTML={{ __html: frozenSvgContent }}
                    />
                  </div>
                </section>
                <section className="preview-compare-pane live">
                  <div className="preview-compare-label">실시간</div>
                  <MermaidPreview
                    code={code}
                    zoom={zoom}
                    onErrorChange={setParseError}
                    onSvgChange={setSvgContent}
                    onApplySelection={handlePreviewSelectionApply}
                  />
                </section>
              </div>
            ) : (
              <MermaidPreview
                code={code}
                zoom={zoom}
                onErrorChange={setParseError}
                onSvgChange={setSvgContent}
                onApplySelection={handlePreviewSelectionApply}
              />
            )}
          </div>
          <div className="preview-footer">
            {isMobileClient ? (
              <>
                <span>모바일에서는 +/- 버튼으로 확대/축소합니다.</span>
                <span>데스크톱에서는 Alt/Option, Ctrl/Cmd + scroll도 지원합니다.</span>
              </>
            ) : (
              <>
                <span>Zoom: Windows/Linux Alt + scroll, macOS Option + scroll</span>
                <span>Fallback: Ctrl 또는 Cmd + scroll, 또는 +/- 버튼</span>
              </>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
