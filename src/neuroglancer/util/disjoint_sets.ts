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

// Rank of a set is the smallest ordinal greater than the 
// any rank contained within the set. e.g. empty set 
function linkUnequalSetRepresentatives(i: any, j: any): any {
  let iRank = i[rankSymbol];
  let jRank = j[rankSymbol];
  if (iRank > jRank) {
    j[parentSymbol] = i;
    return i;
  }

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

function initializeElement(v: any) {
  v[parentSymbol] = v;
  v[rankSymbol] = 0;
  v[nextSymbol] = v[prevSymbol] = v;
}

const minSymbol = Symbol('disjoint_sets:min');

function isRootElement(v: any) {
  return v[parentSymbol] === v;
}

/**
 * Represents a collection of disjoint sets of Uint64 values.
 *
 * Supports merging sets, retrieving the minimum Uint64 value contained in a set (the representative
 * value), and iterating over the elements contained in a set.
 */
export class DisjointUint64Sets {
  private map = new Map<string, Uint64>();
  generation = 0;

  has(x: Uint64): boolean {
    let key = x.toString();
    let element = this.map.get(key);
    return element === undefined;
  }

  get(x: Uint64): Uint64 {
    let key = x.toString();
    let element = this.map.get(key);
    if (element === undefined) {
      return x;
    }
    return findRepresentative(element)[minSymbol];
  }

  private equal(a: Uint64, b: Uint64) {
    return (b === a || Uint64.equal(b, a));
  }

  equalSet(a: Uint64, b: Uint64) {
    return this.equal(this.get(a), this.get(b));
  }

  isMinElement(x: Uint64) {
    let y = this.get(x);
    return this.equal(x, y);
  }

  private makeSet(x: Uint64): Uint64 {
    let key = x.toString();
    let {map} = this;
    let element = map.get(key);
    if (element === undefined) {
      element = x.clone();
      initializeElement(element);
      (<any>element)[minSymbol] = element;
      map.set(key, element);
      return element;
    }
    return findRepresentative(element);
  }

  link(a: Uint64, b: Uint64): boolean {
    a = this.makeSet(a);
    b = this.makeSet(b);
    if (a === b) {
      return false;
    }
    this.generation++;
    let newNode = linkUnequalSetRepresentatives(a, b);
    spliceCircularLists(a, b);
    let aMin = (<any>a)[minSymbol];
    let bMin = (<any>b)[minSymbol];
    newNode[minSymbol] = Uint64.min(aMin, bMin);
    return true;
  }

  unlink (a: Uint64): boolean {
    let key = a.toString();
    let element = this.map.get(key);

    if (!element 
      || (
        (<any>element)[parentSymbol] === element
        && (<any>element)[rankSymbol] === 0)) {

      return true;
    }

    let nodes = this.shatter(element);

    if (nodes[0] === element) {
      nodes.shift();
    }

    if (nodes.length === 0) {
      return false;
    }

    let is_ok = true;

    if (nodes.length > 1) {
      nodes.forEach( (x) => {
        if (x !== element) {
          let this_is_ok = this.link(nodes[0], x);
          is_ok = is_ok && this_is_ok;
        }
      });
    }

    return is_ok;
  }

  private shatter (a: Uint64) : Uint64[] {
    let rep = this.makeSet(a);

    let nodes = [];
    for (let node of setElementIterator(rep)) {
      nodes.push(node);
    } 

    nodes.forEach(initializeElement);

    return nodes;
  }

  split (a: Uint64[], b: Uint64[]) : boolean {
    if (a.length === 0 || b.length === 0) {
      return false;
    }

    let consistencyfn = (list: Uint64[]) => {
      let root = this.get(list[0]);
      for (let elem of list) {
        if (root !== this.get(elem)) {
          throw new Error(`${elem} was not attached to ${list}`);
        }
      }
    };

    consistencyfn(a);
    consistencyfn(b);

    if (!this.equalSet(a[0], b[0])) {
      throw new Error(`${a} and ${b} are not in the same set.`);
    }

    this.shatter(a[0]);

    a.forEach( (x) => this.link(a[0], x) );
    b.forEach( (x) => this.link(b[0], x) );

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
   * each set.  The members are sorted in numerical order, and the sets are sorted in numerical
   * order of their smallest elements.
   */
  toJSON(): string[][] {
    let sets = new Array<Uint64[]>();
    for (let element of this.map.values()) {
      if (isRootElement(element)) {
        let members = new Array<Uint64>();
        for (let member of setElementIterator(element)) {
          members.push(member);
        }
        if (members.length > 1) {
          members.sort(Uint64.compare);
          sets.push(members);
        }
      }
    }
    sets.sort((a, b) => Uint64.compare(a[0], b[0]));
    return sets.map(set => set.map(element => element.toString()));
  }
}
