'use client';

import type { BoardGroup } from '@/lib/types';

/** 게시판 + 말머리 선택 — 에디터 폼과 사진 폼이 함께 쓴다 */
export function BoardSelect({
  boardGroups,
  boardSlug,
  category,
  categories,
  onBoardChange,
  onCategoryChange,
}: {
  boardGroups: BoardGroup[];
  boardSlug: string;
  category: string;
  categories?: string[];
  onBoardChange: (slug: string) => void;
  onCategoryChange: (category: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <select
        name="board"
        value={boardSlug}
        onChange={(e) => onBoardChange(e.target.value)}
        className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm sm:w-56"
      >
        {boardGroups.map((group) => (
          <optgroup key={group.id} label={group.name}>
            {group.boards.map((board) => (
              <option key={board.slug} value={board.slug}>
                {board.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {categories && (
        <select
          name="category"
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm sm:w-40"
        >
          <option value="">말머리 선택</option>
          {categories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      )}
    </div>
  );
}
