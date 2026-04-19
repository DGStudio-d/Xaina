import { FilterKey, LibraryNovel, SortKey } from "@/core/library/store";
import React, { createContext, useContext, useMemo, useReducer } from "react";

// ─── State shape ──────────────────────────────────────────────────────────────

export interface LibraryState {
  novels: LibraryNovel[];
  sort: SortKey;
  filter: FilterKey;
  search: string;
}

const initialState: LibraryState = {
  novels: [],
  sort: "addedAt",
  filter: "all",
  search: "",
};

// ─── Actions ──────────────────────────────────────────────────────────────────

export type LibraryAction =
  | { type: "SET_NOVELS"; novels: LibraryNovel[] }
  | { type: "SET_SORT"; sort: SortKey }
  | { type: "SET_FILTER"; filter: FilterKey }
  | { type: "SET_SEARCH"; search: string }
  | { type: "TOGGLE_FAVORITE"; novelId: string; fav: boolean }
  | { type: "REMOVE"; novelId: string };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function libraryReducer(
  state: LibraryState,
  action: LibraryAction,
): LibraryState {
  switch (action.type) {
    case "SET_NOVELS":
      return { ...state, novels: action.novels };
    case "SET_SORT":
      return { ...state, sort: action.sort };
    case "SET_FILTER":
      return { ...state, filter: action.filter };
    case "SET_SEARCH":
      return { ...state, search: action.search };
    case "TOGGLE_FAVORITE":
      return {
        ...state,
        novels: state.novels.map((n) =>
          n.id === action.novelId ? { ...n, favorite: action.fav ? 1 : 0 } : n,
        ),
      };
    case "REMOVE":
      return {
        ...state,
        novels: state.novels.filter((n) => n.id !== action.novelId),
      };
    default:
      return state;
  }
}

// ─── Contexts ─────────────────────────────────────────────────────────────────

const LibraryContext = createContext<LibraryState>(initialState);
const LibraryDispatchContext =
  createContext<React.Dispatch<LibraryAction> | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(libraryReducer, initialState);

  // Memoize dispatch — it's stable from useReducer but wrap for safety
  const stableDispatch = useMemo(() => dispatch, []);

  return (
    <LibraryContext.Provider value={state}>
      <LibraryDispatchContext.Provider value={stableDispatch}>
        {children}
      </LibraryDispatchContext.Provider>
    </LibraryContext.Provider>
  );
}

// ─── Raw context hooks (internal use) ────────────────────────────────────────

export function useLibraryState(): LibraryState {
  return useContext(LibraryContext);
}

export function useLibraryDispatch(): React.Dispatch<LibraryAction> {
  const dispatch = useContext(LibraryDispatchContext);
  if (!dispatch)
    throw new Error("useLibraryDispatch must be used inside LibraryProvider");
  return dispatch;
}
