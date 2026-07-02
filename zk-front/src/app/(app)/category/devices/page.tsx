import Image from "next/image";
import CategoryHeader from "@/components/category/CategoryHeader";
import { categoryMetadata } from "@/lib/seo";

export const metadata = categoryMetadata("devices");

const DEVICES = Array.from({ length: 12 }).map((_, i) => ({
  id: i + 1,
  brand: ["Samsung", "Apple", "Samsung", "Apple", "Google"][i % 5],
  name: [
    "Galaxy S24 Ultra",
    "iPhone 15 Pro Max",
    "Galaxy Z Flip 6",
    "iPhone 15",
    "Pixel 8 Pro",
  ][i % 5],
  releasedAt: `2024.0${(i % 9) + 1}`,
  retailPrice: 1290000 + (i % 5) * 250000,
  bestPrice: 590000 + (i % 5) * 180000,
  storage: ["256GB", "256GB", "512GB", "128GB", "256GB"][i % 5],
  color: ["티타늄 블랙", "내추럴 티타늄", "실버 섀도우", "블루", "옵시디언"][i % 5],
  thumb: ["/job_default_image.jpg", "/alt_image.jpg", "/profile-base.png", "/logo.png"][i % 4],
  badge: i < 3 ? "NEW" : i < 6 ? "BEST" : null,
}));

export default function DevicesPage() {
  return (
    <div className="space-y-6">
      <CategoryHeader slug="devices" />

      {/* 브랜드 필터 */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {["전체", "Samsung", "Apple", "Google", "Xiaomi"].map((b, i) => (
          <button
            key={b}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-colors ${
              i === 0
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      {/* 카드 그리드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {DEVICES.map((d) => (
          <article
            key={d.id}
            className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer group"
          >
            <div className="relative aspect-square bg-slate-50">
              <Image
                src={d.thumb}
                alt={d.name}
                fill
                sizes="(min-width:1024px) 25vw, (min-width:768px) 33vw, 50vw"
                className="object-cover group-hover:scale-105 transition-transform"
              />
              {d.badge && (
                <span
                  className={`absolute top-2 left-2 text-[10px] font-black px-2 py-0.5 rounded ${
                    d.badge === "NEW"
                      ? "bg-emerald-500 text-white"
                      : "bg-orange-500 text-white"
                  }`}
                >
                  {d.badge}
                </span>
              )}
            </div>
            <div className="p-4">
              <p className="text-[11px] text-slate-400 font-bold">{d.brand}</p>
              <h3 className="font-bold text-slate-900 leading-snug mt-0.5 line-clamp-1">
                {d.name}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                {d.storage} · {d.color}
              </p>
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-[11px] text-slate-400 line-through">
                  출고 {d.retailPrice.toLocaleString()}원
                </p>
                <p className="text-sm font-black text-blue-600 mt-0.5">
                  최저 {d.bestPrice.toLocaleString()}원
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
