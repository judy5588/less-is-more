"use client";

import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Box,
  ChevronDown,
  ChevronRight,
  Cookie,
  Cpu,
  CupSoda,
  Flower,
  Lamp,
  Laptop,
  Layers,
  Package,
  Search,
  Shirt,
  Sofa,
  SlidersHorizontal,
  Sparkles,
  Target,
  Utensils,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "less-is-more-inventory-v1";
const SAGE = "#829281";
const ICON_STROKE = 1.2;
const LINEN = "#F9F8F6";

/** ——— 位置树 Space > Container > Slot（需求：库存透明化 / 物理位置） ——— */
type SlotNode = { id: string; name: string };
type ContainerNode = { id: string; name: string; slots: SlotNode[] };
type SpaceNode = { id: string; name: string; containers: ContainerNode[] };

const LOCATION_TREE: SpaceNode[] = [
  {
    id: "sp-living",
    name: "客厅",
    containers: [
      {
        id: "ct-tv",
        name: "电视柜",
        slots: [
          { id: "sl-tv-l", name: "左侧抽屉" },
          { id: "sl-tv-r", name: "右侧抽屉" },
        ],
      },
      {
        id: "ct-shelf",
        name: "置物架",
        slots: [{ id: "sl-shelf-2", name: "第二层" }],
      },
    ],
  },
  {
    id: "sp-bedroom",
    name: "卧室",
    containers: [
      {
        id: "ct-closet",
        name: "衣柜",
        slots: [
          { id: "sl-closet-top", name: "顶格" },
          { id: "sl-closet-mid", name: "中层挂衣" },
        ],
      },
      {
        id: "ct-night",
        name: "床头柜",
        slots: [{ id: "sl-night-1", name: "上层" }],
      },
    ],
  },
  {
    id: "sp-study",
    name: "书房",
    containers: [
      {
        id: "ct-desk",
        name: "书桌",
        slots: [
          { id: "sl-desk-l", name: "左抽屉" },
          { id: "sl-desk-r", name: "右抽屉" },
        ],
      },
    ],
  },
];

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  essential: boolean;
  daysInStorage: number;
  slotId: string;
};

const SEED_ITEMS: InventoryItem[] = [
  {
    id: "i1",
    name: "亚麻抱枕套",
    category: "家纺",
    price: 89,
    quantity: 2,
    essential: false,
    daysInStorage: 120,
    slotId: "sl-tv-l",
  },
  {
    id: "i2",
    name: "USB-C 扩展坞",
    category: "数码",
    price: 199,
    quantity: 1,
    essential: true,
    daysInStorage: 14,
    slotId: "sl-desk-l",
  },
  {
    id: "i3",
    name: "护手霜（未拆）",
    category: "个护",
    price: 45,
    quantity: 3,
    essential: false,
    daysInStorage: 210,
    slotId: "sl-night-1",
  },
  {
    id: "i4",
    name: "陶瓷马克杯",
    category: "餐厨",
    price: 36,
    quantity: 4,
    essential: false,
    daysInStorage: 45,
    slotId: "sl-shelf-2",
  },
  {
    id: "i5",
    name: "羊毛围巾",
    category: "服饰",
    price: 268,
    quantity: 1,
    essential: true,
    daysInStorage: 180,
    slotId: "sl-closet-top",
  },
  {
    id: "i6",
    name: "蓝牙鼠标",
    category: "数码",
    price: 129,
    quantity: 2,
    essential: false,
    daysInStorage: 95,
    slotId: "sl-desk-r",
  },
];

function buildLocationLabel(slotId: string): string {
  for (const space of LOCATION_TREE) {
    for (const container of space.containers) {
      const slot = container.slots.find((s) => s.id === slotId);
      if (slot) {
        return `${space.name} · ${container.name} · ${slot.name}`;
      }
    }
  }
  return "未知位置";
}

const SLOT_OPTIONS = LOCATION_TREE.flatMap((space) =>
  space.containers.flatMap((container) =>
    container.slots.map((slot) => ({
      id: slot.id,
      label: `${space.name} · ${container.name} · ${slot.name}`,
    }))
  )
);

/** 关键词 → Lucide 图标（细线 + 鼠尾草色在渲染处统一） */
function getItemIcon(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (/(cup|mug|马克|杯|茶)/.test(n)) return CupSoda;
  if (/(shirt|衣|围巾|袜|裤|服|帽)/.test(n)) return Shirt;
  if (/(laptop|笔记本|电脑|macbook)/.test(n)) return Laptop;
  if (/(skincare|护肤|霜|乳|精华|化妆)/.test(n)) return Flower;
  if (/(snack|零食|饼干|cookie|糖)/.test(n)) return Cookie;
  if (/(book|书|杂志)/.test(n)) return BookOpen;
  if (/(lamp|light|灯|照明)/.test(n)) return Lamp;
  if (/(usb|电子|数码|扩展坞|鼠标|线|充电|cpu)/.test(n)) return Cpu;
  if (/(food|餐|厨|食|锅|碗)/.test(n)) return Utensils;
  if (/(pillow|抱枕|床|纺)/.test(n)) return Sofa;
  return Box;
}

type TabId = "inventory" | "decider" | "insights";

function loadStoredItems(): InventoryItem[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InventoryItem[];
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function MobileAppPage() {
  const [items, setItems] = useState<InventoryItem[]>(SEED_ITEMS);
  const [storageReady, setStorageReady] = useState(false);
  const [tab, setTab] = useState<TabId>("inventory");
  const [search, setSearch] = useState("");
  const [filterSlotId, setFilterSlotId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [treeExpanded, setTreeExpanded] = useState<Record<string, boolean>>(
    () => {
      const init: Record<string, boolean> = {};
      LOCATION_TREE.forEach((s) => {
        init[s.id] = true;
        s.containers.forEach((c) => {
          init[c.id] = false;
        });
      });
      return init;
    }
  );

  const [sheetItem, setSheetItem] = useState<InventoryItem | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editQty, setEditQty] = useState("");
  const [editSlotId, setEditSlotId] = useState("");

  useEffect(() => {
    const stored = loadStoredItems();
    if (stored && stored.length > 0) {
      setItems(stored);
    }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady || typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore quota */
    }
  }, [items, storageReady]);

  const toggleTree = useCallback((id: string) => {
    setTreeExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items;
    if (filterSlotId) {
      list = list.filter((i) => i.slotId === filterSlotId);
    }
    if (!q) return list;
    return list.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        buildLocationLabel(i.slotId).toLowerCase().includes(q)
    );
  }, [items, search, filterSlotId]);

  const dustTop5 = useMemo(() => {
    return [...items]
      .sort((a, b) => b.daysInStorage - a.daysInStorage)
      .slice(0, 5);
  }, [items]);

  const openEditSheet = (item: InventoryItem) => {
    setSheetItem(item);
    setEditPrice(String(item.price));
    setEditQty(String(item.quantity));
    setEditSlotId(item.slotId);
  };

  const closeSheet = () => setSheetItem(null);

  const saveEdit = () => {
    if (!sheetItem) return;
    const price = Math.max(0, Number.parseFloat(editPrice) || 0);
    const quantity = Math.max(0, Math.round(Number.parseFloat(editQty) || 0));
    const slotId = editSlotId || sheetItem.slotId;
    setItems((prev) =>
      prev.map((i) =>
        i.id === sheetItem.id ? { ...i, price, quantity, slotId } : i
      )
    );
    closeSheet();
  };

  const deleteItem = () => {
    if (!sheetItem) return;
    setItems((prev) => prev.filter((i) => i.id !== sheetItem.id));
    closeSheet();
  };

  /* ——— Buying Gate（需求占位：同类检索 + 闲置率提示） ——— */
  const [gateName, setGateName] = useState("");
  const [gateReason, setGateReason] = useState("");
  const gatePreview = useMemo(() => {
    const name = gateName.trim();
    if (!name) return null;
    const cat = items.find((i) =>
      i.name.toLowerCase().includes(name.toLowerCase())
    )?.category;
    const same = items.filter((i) =>
      cat ? i.category === cat : i.name.toLowerCase().includes(name.toLowerCase())
    );
    if (same.length === 0) {
      return { text: "库存中暂无高度同类项，可结合分类再试。", idleRatio: 0 };
    }
    const dusty = same.filter((i) => i.daysInStorage > 60).length;
    const ratio = Math.round((dusty / same.length) * 100);
    return {
      text:
        ratio > 50
          ? `同类约 ${same.length} 件，其中 ${dusty} 件闲置超 60 天（约 ${ratio}%）。下单前建议先清点现货。`
          : `同类约 ${same.length} 件，闲置压力较低（约 ${ratio}% 长期未用）。`,
      idleRatio: ratio,
    };
  }, [gateName, items]);

  const filterSummary =
    filterSlotId === null
      ? "全部位置"
      : buildLocationLabel(filterSlotId);

  return (
    <div
      className="min-h-full font-sans text-stone-800"
      style={{ backgroundColor: LINEN }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-[480px] flex-col pb-24 shadow-[0_0_0_1px_rgba(0,0,0,0.03)]">
        {/* Sticky glass search */}
        <div
          className="sticky top-0 z-40 px-3 pt-3 pb-2"
          style={{ backgroundColor: `${LINEN}cc` }}
        >
          <div className="flex items-center gap-2 rounded-2xl border border-white/50 bg-white/55 px-3 py-2 shadow-[0_4px_24px_-4px_rgba(90,80,70,0.12)] backdrop-blur-xl backdrop-saturate-150">
            <Search
              className="h-[18px] w-[18px] shrink-0"
              style={{ color: SAGE }}
              strokeWidth={ICON_STROKE}
            />
            <input
              type="search"
              enterKeyHint="search"
              placeholder="搜索物品、分类或位置…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[15px] text-stone-800 outline-none placeholder:text-stone-400"
            />
            <button
              type="button"
              aria-label="按位置筛选"
              onClick={() => setFilterOpen(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-stone-200/60 bg-white/50 text-stone-600 active:scale-95 transition-transform"
            >
              <SlidersHorizontal
                className="h-[18px] w-[18px]"
                style={{ color: SAGE }}
                strokeWidth={ICON_STROKE}
              />
            </button>
          </div>
          {tab === "inventory" && (
            <p className="mt-2 px-1 font-sans text-[11px] text-stone-500">
              筛选：{filterSummary}
              {filterSlotId ? (
                <button
                  type="button"
                  className="ml-2 font-medium text-[#5a6b59] underline decoration-[#829281]/40"
                  onClick={() => setFilterSlotId(null)}
                >
                  清除
                </button>
              ) : null}
            </p>
          )}
        </div>

        <div className="flex-1 px-3 pt-1">
          {tab === "inventory" && (
            <>
              <h1 className="font-serif text-xl font-semibold tracking-tight text-stone-900">
                循迹 · 库存
              </h1>
              <p className="mt-0.5 font-sans text-xs text-stone-500">
                共 {filteredItems.length} 件
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {filteredItems.map((item) => {
                  const Icon = getItemIcon(item.name);
                  const dusty = item.daysInStorage >= 90;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openEditSheet(item)}
                      className="flex flex-col rounded-2xl border border-stone-200/70 bg-white/75 p-3 text-left shadow-[0_8px_28px_-12px_rgba(60,50,40,0.18)] transition-transform active:scale-95"
                    >
                      <div className="flex items-start gap-2">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#829281]/12">
                          <Icon
                            className="h-[18px] w-[18px]"
                            style={{ color: SAGE }}
                            strokeWidth={ICON_STROKE}
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-serif text-[14px] font-medium leading-snug text-stone-900 line-clamp-2">
                            {item.name}
                          </p>
                          <p className="mt-0.5 font-sans text-[11px] text-stone-500">
                            {item.category}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-2 border-t border-stone-100/90 pt-2">
                        <span className="font-sans text-[13px] font-medium tabular-nums text-stone-800">
                          ¥{item.price}
                        </span>
                        <span
                          className={`font-sans rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums ${
                            dusty
                              ? "bg-amber-100/90 text-amber-900"
                              : "bg-stone-100/90 text-stone-600"
                          }`}
                        >
                          闲置 {item.daysInStorage} 天
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {filteredItems.length === 0 && (
                <div className="flex flex-col items-center px-4 py-14">
                  <WarmEmptyIllustration />
                  <p className="mt-5 font-serif text-base text-stone-700">
                    没有找到物品
                  </p>
                  <p className="mt-1 text-center font-sans text-xs text-stone-500">
                    换个关键词，或清空位置筛选试试
                  </p>
                </div>
              )}
            </>
          )}

          {tab === "decider" && (
            <div className="pb-4">
              <h1 className="font-serif text-xl font-semibold text-stone-900">
                购买决策门
              </h1>
              <p className="mt-1 font-sans text-xs text-stone-500">
                拟购前对照库存与闲置情况（本地演算）
              </p>
              <div className="mt-4 space-y-3 rounded-2xl border border-stone-200/70 bg-white/75 p-4 shadow-[0_8px_28px_-12px_rgba(60,50,40,0.12)]">
                <label className="block font-sans text-[11px] font-medium text-stone-500">
                  物品名
                  <input
                    value={gateName}
                    onChange={(e) => setGateName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200/80 bg-white/90 px-3 py-2.5 font-sans text-sm outline-none focus:ring-2 focus:ring-[#829281]/25"
                    placeholder="例如：蓝牙耳机"
                  />
                </label>
                <label className="block font-sans text-[11px] font-medium text-stone-500">
                  购买理由
                  <textarea
                    value={gateReason}
                    onChange={(e) => setGateReason(e.target.value)}
                    rows={3}
                    className="mt-1 w-full resize-none rounded-xl border border-stone-200/80 bg-white/90 px-3 py-2.5 font-sans text-sm outline-none focus:ring-2 focus:ring-[#829281]/25"
                    placeholder="简短说明用途或动机…"
                  />
                </label>
              </div>
              {gatePreview && (
                <div
                  className={`mt-4 rounded-2xl border p-4 font-sans text-sm leading-relaxed ${
                    gatePreview.idleRatio > 50
                      ? "border-amber-200/80 bg-amber-50/80 text-amber-950"
                      : "border-[#829281]/25 bg-[#829281]/08 text-stone-800"
                  }`}
                >
                  {gatePreview.text}
                </div>
              )}
            </div>
          )}

          {tab === "insights" && (
            <div className="pb-4">
              <h1 className="font-serif text-xl font-semibold text-stone-900">
                吃灰榜单
              </h1>
              <p className="mt-1 font-sans text-xs text-stone-500">
                闲置最久的 5 件 · 引导断舍离
              </p>
              <ul className="mt-4 space-y-3">
                {dustTop5.map((item, idx) => {
                  const Icon = getItemIcon(item.name);
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 rounded-2xl border border-stone-200/70 bg-white/75 px-3 py-3 shadow-[0_6px_20px_-10px_rgba(60,50,40,0.15)]"
                    >
                      <span className="font-sans text-sm font-semibold tabular-nums text-stone-400">
                        {idx + 1}
                      </span>
                      <Icon
                        className="h-5 w-5 shrink-0"
                        style={{ color: SAGE }}
                        strokeWidth={ICON_STROKE}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-serif text-sm font-medium text-stone-900">
                          {item.name}
                        </p>
                        <p className="font-sans text-[11px] text-stone-500">
                          {buildLocationLabel(item.slotId)}
                        </p>
                      </div>
                      <span className="font-sans text-xs font-semibold tabular-nums text-amber-800">
                        {item.daysInStorage}d
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        {/* Filter drawer */}
        {filterOpen && (
          <div
            className="fixed inset-0 z-50 flex justify-center bg-black/25"
            role="presentation"
            onClick={() => setFilterOpen(false)}
          >
            <div
              className="mt-auto flex h-[min(78vh,560px)] w-full max-w-[480px] flex-col rounded-t-3xl border border-stone-200/80 bg-[#FDFCFA] shadow-[0_-12px_40px_rgba(0,0,0,0.12)]"
              role="dialog"
              aria-label="位置筛选"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                <p className="font-serif text-base font-semibold text-stone-900">
                  按位置筛选
                </p>
                <button
                  type="button"
                  onClick={() => setFilterOpen(false)}
                  className="rounded-full p-2 text-stone-500 active:bg-stone-100"
                  aria-label="关闭"
                >
                  <X className="h-5 w-5" strokeWidth={ICON_STROKE} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
                <button
                  type="button"
                  onClick={() => {
                    setFilterSlotId(null);
                    setFilterOpen(false);
                  }}
                  className={`mb-2 w-full rounded-xl px-3 py-2.5 text-left font-sans text-sm ${
                    filterSlotId === null
                      ? "bg-[#829281]/18 font-medium text-[#3d4a3c]"
                      : "bg-white/80 text-stone-600"
                  }`}
                >
                  全部位置
                </button>
                {LOCATION_TREE.map((space) => (
                  <div key={space.id} className="mb-1">
                    <button
                      type="button"
                      onClick={() => toggleTree(space.id)}
                      className="flex w-full items-center gap-1 rounded-lg py-2 text-left font-serif text-sm font-medium text-stone-800"
                    >
                      {treeExpanded[space.id] ? (
                        <ChevronDown className="h-4 w-4 text-stone-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-stone-400" />
                      )}
                      {space.name}
                    </button>
                    {treeExpanded[space.id] && (
                      <div className="ml-3 border-l border-stone-200 pl-2">
                        {space.containers.map((container) => (
                          <div key={container.id}>
                            <button
                              type="button"
                              onClick={() => toggleTree(container.id)}
                              className="flex w-full items-center gap-1 py-1.5 text-left font-sans text-[13px] text-stone-600"
                            >
                              {treeExpanded[container.id] ? (
                                <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-stone-400" />
                              )}
                              <Layers
                                className="h-3.5 w-3.5"
                                style={{ color: SAGE }}
                                strokeWidth={ICON_STROKE}
                              />
                              {container.name}
                            </button>
                            {treeExpanded[container.id] && (
                              <ul className="ml-4 space-y-1 border-l border-dashed border-stone-200 pl-2 pb-2">
                                {container.slots.map((slot) => (
                                  <li key={slot.id}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFilterSlotId(slot.id);
                                        setFilterOpen(false);
                                      }}
                                      className={`w-full rounded-lg px-2 py-2 text-left font-sans text-xs ${
                                        filterSlotId === slot.id
                                          ? "bg-[#829281]/20 font-medium text-[#3d4a3c]"
                                          : "text-stone-600"
                                      }`}
                                    >
                                      {slot.name}
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Edit bottom sheet */}
        {sheetItem && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/30"
            role="presentation"
            onClick={closeSheet}
          >
            <div
              className="w-full max-w-[480px] rounded-t-3xl border border-stone-200/80 bg-[#FDFCFA] px-4 pb-8 pt-2 shadow-[0_-16px_48px_rgba(0,0,0,0.15)]"
              style={{
                paddingBottom: "max(2rem, env(safe-area-inset-bottom, 0px))",
              }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-label="编辑物品"
            >
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300/80" />
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-serif text-lg font-semibold text-stone-900">
                    {sheetItem.name}
                  </h2>
                  <p className="font-sans text-xs text-stone-500">
                    {sheetItem.category}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeSheet}
                  className="rounded-full p-2 text-stone-500"
                  aria-label="关闭"
                >
                  <X className="h-5 w-5" strokeWidth={ICON_STROKE} />
                </button>
              </div>

              <div className="mt-4 space-y-3">
                <label className="block font-sans text-[11px] font-medium text-stone-500">
                  价格（元）
                  <input
                    inputMode="decimal"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200/80 bg-white px-3 py-2.5 font-sans text-sm tabular-nums outline-none focus:ring-2 focus:ring-[#829281]/25"
                  />
                </label>
                <label className="block font-sans text-[11px] font-medium text-stone-500">
                  数量
                  <input
                    inputMode="numeric"
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200/80 bg-white px-3 py-2.5 font-sans text-sm tabular-nums outline-none focus:ring-2 focus:ring-[#829281]/25"
                  />
                </label>
                <label className="block font-sans text-[11px] font-medium text-stone-500">
                  位置
                  <select
                    value={editSlotId}
                    onChange={(e) => setEditSlotId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-stone-200/80 bg-white px-3 py-2.5 font-sans text-sm outline-none focus:ring-2 focus:ring-[#829281]/25"
                  >
                    {SLOT_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={deleteItem}
                  className="flex-1 rounded-2xl border border-red-200/80 bg-red-50/80 py-3 font-sans text-sm font-medium text-red-800 active:scale-[0.98] transition-transform"
                >
                  删除
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  className="flex-[2] rounded-2xl bg-[#829281] py-3 font-sans text-sm font-semibold text-white shadow-md active:scale-[0.98] transition-transform"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom tab bar */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 flex justify-center border-t border-stone-200/60 bg-[#F9F8F6]/92 backdrop-blur-lg"
          style={{
            paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
          }}
        >
          <div className="flex h-14 w-full max-w-[480px] items-stretch px-2">
            <TabButton
              active={tab === "inventory"}
              onClick={() => setTab("inventory")}
              icon={Package}
              label="Inventory"
            />
            <TabButton
              active={tab === "decider"}
              onClick={() => setTab("decider")}
              icon={Target}
              label="Buying Gate"
            />
            <TabButton
              active={tab === "insights"}
              onClick={() => setTab("insights")}
              icon={Sparkles}
              label="Insights"
            />
          </div>
        </nav>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 font-sans text-[10px] font-medium transition-colors ${
        active ? "text-[#4d5c4c]" : "text-stone-400"
      }`}
    >
      <Icon
        className="h-5 w-5"
        style={{ color: active ? SAGE : undefined }}
        strokeWidth={ICON_STROKE}
      />
      {label}
    </button>
  );
}

/** 温和空状态插画（内联 SVG，无外链） */
function WarmEmptyIllustration() {
  return (
    <svg
      width="200"
      height="140"
      viewBox="0 0 200 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="text-[#829281]"
      aria-hidden
    >
      <ellipse cx="100" cy="118" rx="72" ry="14" fill="#E8E4DC" opacity="0.7" />
      <path
        d="M52 88c0-22 18-40 40-40h16c22 0 40 18 40 40v8H52v-8z"
        fill="#F5F0E8"
        stroke="#C9C2B5"
        strokeWidth="1.2"
      />
      <rect
        x="68"
        y="44"
        width="64"
        height="48"
        rx="10"
        fill="#FAF8F5"
        stroke="#829281"
        strokeWidth="1.2"
        opacity="0.45"
      />
      <path
        d="M88 58h24M88 68h18M88 78h22"
        stroke="#829281"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.5"
      />
      <circle cx="100" cy="28" r="10" fill="#E8EDE5" stroke="#829281" strokeWidth="1.2" />
      <path
        d="M96 32c2-4 6-6 10-4"
        stroke="#829281"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}
