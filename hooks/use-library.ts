import {
    useLibraryDispatch,
    useLibraryState
} from "@/context/library-context";
import {
    FilterKey,
    getLibraryNovels,
    LibraryNovel,
    removeFromLibrary,
    SortKey,
    toggleFavorite,
} from "@/core/library/store";
import { setInLibrary } from "@/lib/db";
import { useCallback } from "react";

// ─── Read ─────────────────────────────────────────────────────────────────────

/** All novels currently in the library (filtered/sorted/searched). */
export function useLibrary(): LibraryNovel[] {
  return useLibraryState().novels;
}

/** Current sort key. */
export function useLibrarySort(): SortKey {
  return useLibraryState().sort;
}

/** Current filter key. */
export function useLibraryFilter(): FilterKey {
  return useLibraryState().filter;
}

/** Current search string. */
export function useLibrarySearch(): string {
  return useLibraryState().search;
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Returns a `refresh` function that re-queries the DB and syncs state.
 * Call this on focus or after any mutation.
 */
export function useLibraryRefresh() {
  const dispatch = useLibraryDispatch();
  const { sort, filter, search } = useLibraryState();

  return useCallback(() => {
    const novels = getLibraryNovels(sort, filter, search);
    dispatch({ type: "SET_NOVELS", novels });
  }, [dispatch, sort, filter, search]);
}

/** Change sort and immediately refresh. */
export function useSetLibrarySort() {
  const dispatch = useLibraryDispatch();
  const { filter, search } = useLibraryState();

  return useCallback(
    (sort: SortKey) => {
      dispatch({ type: "SET_SORT", sort });
      dispatch({
        type: "SET_NOVELS",
        novels: getLibraryNovels(sort, filter, search),
      });
    },
    [dispatch, filter, search],
  );
}

/** Change filter and immediately refresh. */
export function useSetLibraryFilter() {
  const dispatch = useLibraryDispatch();
  const { sort, search } = useLibraryState();

  return useCallback(
    (filter: FilterKey) => {
      dispatch({ type: "SET_FILTER", filter });
      dispatch({
        type: "SET_NOVELS",
        novels: getLibraryNovels(sort, filter, search),
      });
    },
    [dispatch, sort, search],
  );
}

/** Change search and immediately refresh. */
export function useSetLibrarySearch() {
  const dispatch = useLibraryDispatch();
  const { sort, filter } = useLibraryState();

  return useCallback(
    (search: string) => {
      dispatch({ type: "SET_SEARCH", search });
      dispatch({
        type: "SET_NOVELS",
        novels: getLibraryNovels(sort, filter, search),
      });
    },
    [dispatch, sort, filter],
  );
}

/** Add a novel to the library. */
export function useAddToLibrary() {
  const refresh = useLibraryRefresh();

  return useCallback(
    (novelId: string) => {
      setInLibrary(novelId, true);
      refresh();
    },
    [refresh],
  );
}

/** Remove a novel from the library (optimistic + DB). */
export function useRemoveFromLibrary() {
  const dispatch = useLibraryDispatch();

  return useCallback(
    (novelId: string) => {
      removeFromLibrary(novelId);
      dispatch({ type: "REMOVE", novelId });
    },
    [dispatch],
  );
}

/** Toggle favorite (optimistic + DB). */
export function useToggleFavorite() {
  const dispatch = useLibraryDispatch();

  return useCallback(
    (novelId: string, fav: boolean) => {
      toggleFavorite(novelId, fav);
      dispatch({ type: "TOGGLE_FAVORITE", novelId, fav });
    },
    [dispatch],
  );
}
