/**
 * @license
 * Copyright 2016 Google Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Uint64} from 'neuroglancer/util/uint64';

const rankSymbol = Symbol('disjoint_sets:rank');
const parentSymbol = Symbol('disjoint_sets:parent');
const nextSymbol = Symbol('disjoint_sets:next');
const prevSymbol = Symbol('disjoint_sets:prev');
const splitSymbol = Symbol('disjoint_sets:split');
const saveSymbol = Symbol('disjoint_sets:save');
const minSymbol = Symbol('disjoint_sets:min');


function findRepresentative(v: any): any {
  // First pass: find the root, which will be stored in ancestor.
  let old = v;
  let ancestor = v[parentSymbol];
  while (ancestor !== v) {
    v = ancestor;
    ancestor = v[parentSymbol];
  }
  // Second pass: set all of the parent pointers along the path from the
  // original element `old' to refer directly to the root `ancestor'.
  v = old[parentSymbol];
  while (ancestor !== v) {
    old[parentSymbol] = ancestor;
    old = v;
    v = old[parentSymbol];
  }
  return ancestor;
}

function linkUnequalSetRepresentatives(i: any, j: any): any {
  let iRank = i[rankSymbol];
  let jRank = j[rankSymbol];
  // Attach j to i tree
  if (iRank > jRank) {
    j[parentSymbol] = i;
    return i;
  }
  // Attach i to j tree
  i[parentSymbol] = j;
  if (iRank === jRank) {
    j[rankSymbol] = jRank + 1;
  }
  return j;
}

function spliceCircularLists(i: any, j: any) {
  let iPrev = i[prevSymbol];
  let jPrev = j[prevSymbol];

  // Connect end of i to beginning of j.
  j[prevSymbol] = iPrev;
  iPrev[nextSymbol] = j;

  // Connect end of j to beginning of i.
  i[prevSymbol] = jPrev;
  jPrev[nextSymbol] = i;
}

function* setElementIterator(i: any) {
  let j = i;
  do {
    yield j;
    j = j[nextSymbol];
  } while (j !== i);
}

function initializeElement(x: any): Uint64 {
  let v = x.clone();
  v[parentSymbol] = v;
  v[rankSymbol] = 0;
  v[saveSymbol] = false;
  v[nextSymbol] = v[prevSymbol] = v;
  v[splitSymbol] = x[splitSymbol] || 0;
  return v;
}

function isRootElement(v: any) {
  return v[parentSymbol] === v;
}

// Set uint64 ID value and split value
export function setRegion(x: Uint64, s: string) {
  let [main, split] = s.split(':');
  let split_id = parseInt(split) || 0;
  let v = x.parseString(main, 10) as any;
  v[splitSymbol] = split_id;
}
export function getRegionId(x: Uint64): number {
  return (x as any)[splitSymbol] as number;
}
// Display uint64 ID value and split value as strings
export function getRegion(x: Uint64): string {
  let split_id = getRegionId(x);
  let s = x.toString();
  if (split_id) {
    return s + ':' + split_id.toString(); 
  }
  return s;
}

export interface SplitState {
  // All regions for all main IDs
  mainMap: Map<string, number[]>
  // All regions for all boundaries
  zMap: Map<string, number[]>
  yMap: Map<string, number[]>
  xMap: Map<string, number[]>
  // List all variables for all regions
  subregions: Array<[string, string, string, string]>
}

/**
 * Represents a collection of disjoint sets of Uint64 values.
 *
 * Supports merging sets, retrieving the minimum Uint64 value contained in a set (the representative
 * value), and iterating over the elements contained in a set.
 */
let SPLIT_0A = initializeElement(new Uint64())
let SPLIT_0B = initializeElement(new Uint64())
setRegion(SPLIT_0A, '0:1')
setRegion(SPLIT_0B, '0:2')

export class DisjointUint64Sets {
  private map = new Map<string, Uint64>();
  generation = 0;

  splitState: SplitState = {
    zMap: new Map([
      ['0:1', [0]]
    ]),
    yMap: new Map([
      ['1:2', [0]]
    ]),
    xMap: new Map([
      ['2:3', [0]]
    ]),
    mainMap: new Map([
      ['45', [0]]
    ]),
    subregions: [
      ['45:1', '2:3', '1:2', '0:1']
    ],
  }

  get(x: Uint64): Uint64 {
    let key = x.toString();
    let element = this.map.get(key);
    if (element === undefined) {
      return x;
    }
    return findRepresentative(element)[minSymbol];
  }

  isMinElement(x: Uint64) {
    let y = this.get(x);
    return (y === x || Uint64.equal(y, x));
  }

  private makeSet(x: Uint64, save=false): Uint64 {
    let key = x.toString();
    let element = this.map.get(key);
    // Need to create new set
    if (element === undefined) {
      element = initializeElement(x);
      this.saveNode(element, save);
      (<any>element)[minSymbol] = element;
      this.map.set(key, element);
      return element;
    }
    this.saveNode(element, save);
    return findRepresentative(element);
  }

  private saveNode(node: any, save=false) {
    // Save or unsave the node
    node[saveSymbol] = save;
  }

  private isSaved(node: any): boolean {
    return node[saveSymbol];
  }

  split() {
    return;
  }

  link(a: Uint64, b: Uint64, save=false): boolean {
    a = this.makeSet(a, save);
    b = this.makeSet(b, save);
    if (a === b) {
      return false;
    }
    this.generation++;
    // Actually run the union operation
    let newNode = linkUnequalSetRepresentatives(a, b);
    // Allow iteration through elements
    spliceCircularLists(a, b);
    // Calcluate the new minimum
    let aMin = (<any>a)[minSymbol];
    let bMin = (<any>b)[minSymbol];
    newNode[minSymbol] = Uint64.min(aMin, bMin);
    return true;
  }

  * setElements(a: Uint64): IterableIterator<Uint64> {
    let key = a.toString();
    let element = this.map.get(key);
    if (element === undefined) {
      yield a;
    } else {
      yield* setElementIterator(element);
    }
  }

  clear() {
    let {map} = this;
    if (map.size === 0) {
      return false;
    }
    ++this.generation;
    map.clear();
    return true;
  }

  get size() {
    return this.map.size;
  }

  get hasSplits() {
    return this.splitState.subregions.length > 0;
  }

  * mappings(temp = <[Uint64, Uint64]>new Array<Uint64>(2)) {
    for (let element of this.map.values()) {
      temp[0] = element;
      temp[1] = findRepresentative(element)[minSymbol];
      yield temp;
    }
  }

  [Symbol.iterator]() {
    return this.mappings();
  }

  /**
   * Returns an array of arrays of strings, where the arrays contained in the outer array correspond
   * to the disjoint sets, and the strings are the base-10 string representations of the members of
   * each set optionally followed by a colon and the subregion.  The members are sorted in numerical
   * order, and the sets are sorted in numerical order of their smallest elements.
   */
  toJSON(): string[][] {
    let sets = new Array<Uint64[]>();
    for (let element of this.map.values()) {
      if (isRootElement(element)) {
        let members = new Array<Uint64>();
        for (let member of setElementIterator(element)) {
          // Display only unsaved nodes
          if (!this.isSaved(element) || !this.isSaved(member)) {
            members.push(member);
          }
        }
        if (members.length) {
          // Add root element if needed
          if (members.indexOf(element) === -1) {
            members.unshift(element);
          }
          members.sort(Uint64.compare);
          sets.push(members);
        }
      }
    }
    sets.sort((a, b) => Uint64.compare(a[0], b[0]));
    return sets.map(set => set.map(x => getRegion(x)));
  }

  /**
   * Returns an array of arrays of strings, where the arrays in the outer array correspond
   * to individual subregions. Each subregion string has 8 base-10 encoded integres, each
   * separated by a colon. Item 0 is the original ID, and item 1 is the subregion. Items
   * 2 - 7 give the x0:x1:y0:y1:z0:z1 bounds of the region in chunk-indexed coordinates.
   * The subregions are sorted ascending from lowest to highest priority.
   */
  splitJSON(): string[] {
    let split_stringify = (subregion: string[]) => {
      return subregion.join(':');
    }
    return this.splitState.subregions.map(split_stringify);
  }
}
