import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import type { Post } from '@/lib/types';
import type { Shop } from '@/lib/types';
import { CarrierTag, EmptyState, SellerBadge } from '@/components/ui';
import { formatPrice, formatRelative } from '@/lib/utils';

/**
 * 시세 게시판 전용 목록.
 * 일반 게시판과 달리 제목만 보여주지 않고 할부원금·통신사·가입유형을 목록에서 바로 비교할 수 있게 한다.
 */
export function DealTable({ items, shops = [] }: { items: Post[]; shops?: Shop[] }) {
  const shopById = new Map(shops.map((shop) => [shop.id, shop]));
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white">
        <EmptyState>등록된 시세 글이 없습니다.</EmptyState>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="hidden w-full md:table">
        <thead className="border-b border-gray-200 bg-gray-50 text-[11px] text-gray-500">
          <tr>
            <th className="py-3 pl-5 text-left font-semibold">기종</th>
            <th className="w-24 py-3 font-semibold">통신사</th>
            <th className="w-24 py-3 font-semibold">가입유형</th>
            <th className="w-32 py-3 text-right font-semibold">할부원금</th>
            <th className="w-44 py-3 text-left font-semibold">매장</th>
            <th className="w-20 py-3 font-semibold">등록</th>
          </tr>
        </thead>
        <tbody>
          {items.map((post) => {
            const deal = post.deal!;
            const shop = shopById.get(deal.shopId);
            return (
              <tr key={post.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="py-3.5 pl-5">
                  <Link href={`/board/${post.boardSlug}/${post.id}`} className="group block">
                    <span className="flex items-center gap-1.5">
                      <span className="text-[14px] font-bold text-gray-900 group-hover:underline">{deal.model}</span>
                      <span className="text-[11px] text-gray-400">{deal.storage}</span>
                      {post.commentCount > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs font-bold text-zz-500">
                          <MessageCircle size={11} />
                          {post.commentCount}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 line-clamp-1 text-[12px] text-gray-500">{post.title}</span>
                  </Link>
                </td>
                <td className="py-3.5 text-center">
                  <CarrierTag carrier={deal.carrier} />
                </td>
                <td className="py-3.5 text-center text-[13px] text-gray-600">{deal.joinType}</td>
                <td className="py-3.5 pr-2 text-right">
                  <span className="text-lg font-extrabold tracking-tight text-zz-600">{formatPrice(deal.principal)}</span>
                </td>
                <td className="py-3.5">
                  {shop && (
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] text-gray-700">{shop.name}</span>
                      {shop.verified && <SellerBadge />}
                    </span>
                  )}
                </td>
                <td className="py-3.5 text-center text-[11px] text-gray-500">{formatRelative(post.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* 모바일 카드 */}
      <ul className="divide-y divide-gray-100 md:hidden">
        {items.map((post) => {
          const deal = post.deal!;
          const shop = shopById.get(deal.shopId);
          return (
            <li key={`m-${post.id}`}>
              <Link href={`/board/${post.boardSlug}/${post.id}`} className="block px-4 py-4">
                <div className="flex items-center gap-1.5">
                  <CarrierTag carrier={deal.carrier} />
                  <span className="text-xs font-medium text-gray-500">{deal.joinType}</span>
                </div>
                <div className="mt-2 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-gray-900">
                      {deal.model} <span className="text-xs font-normal text-gray-400">{deal.storage}</span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {shop?.name ?? post.author?.nickname} · {formatRelative(post.createdAt)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xl font-extrabold tracking-tight text-zz-600">{formatPrice(deal.principal)}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
