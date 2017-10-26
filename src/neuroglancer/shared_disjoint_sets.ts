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

import {DisjointUint64Sets} from 'neuroglancer/util/disjoint_sets';
import {parseArray} from 'neuroglancer/util/json';
import {NullarySignal} from 'neuroglancer/util/signal';
import {Uint64} from 'neuroglancer/util/uint64';
import {registerRPC, registerSharedObject, RPC, SharedObjectCounterpart} from 'neuroglancer/worker_rpc';

const RPC_TYPE_ID = 'DisjointUint64Sets';
const ADD_METHOD_ID = 'DisjointUint64Sets.add';
const REMOVE_METHOD_ID = 'DisjointUint64Sets.remove';
const SPLIT_METHOD_ID = 'DisjointUint64Sets.split';
const CLEAR_METHOD_ID = 'DisjointUint64Sets.clear';

@registerSharedObject(RPC_TYPE_ID)
export class SharedDisjointUint64Sets extends SharedObjectCounterpart {
  // All sets and sets for current session
  // All sets are used. Current go to json
  allSets = new DisjointUint64Sets();
  currentSets = new DisjointUint64Sets();
  changed = new NullarySignal();

  static makeWithCounterpart(rpc: RPC) {
    let obj = new this();
    obj.initializeCounterpart(rpc);
    return obj;
  }

  disposed() {
    this.currentSets = <any>undefined;
    this.allSets = <any>undefined;
    this.changed = <any>undefined;
    super.disposed();
  }

  get(x: Uint64): Uint64 {
    return this.allSets.get(x);
  }

  private linkAll(a: Uint64, b: Uint64) {
    let linked = this.allSets.link(a, b);
    if (linked) {
      this.link_rpc(a, b);
    }
    return linked;
  }

  linkSaved(a: Uint64, b: Uint64) {
    // Remove first in pair from current
    if (this.currentSets.equalSet(a, b)) {
      this.currentSets.unlink(a);
      this.changed.dispatch();
    }
    else if (this.linkAll(a, b)) {
      this.changed.dispatch();
    }
  }

  link(a: Uint64, b: Uint64) {
    if (this.linkAll(a,b)) {
      // Only new links go to current
      this.currentSets.link(a, b);
      this.changed.dispatch();
    }
  }

  private clearAll() {
    let cleared = this.allSets.clear();
    if (cleared) {
      this.clear_rpc();
    }
    return cleared;
  }

  clearSaved() {
    this.clearAll();
    // Link current to all sets
    for (let pair of this.currentSets) {
      this.linkAll(pair[0], pair[1]);
    }
    if (this.allSets.size !== 0) {
      this.changed.dispatch();
    }
  }

  clear() {
    // Clear current from all sets
    for (let pair of this.currentSets) {
      this.unlinkAll(pair[1]);
    }
    // Clear current from current sets
    if (this.currentSets.size !== 0) {
      this.currentSets.clear();
      this.changed.dispatch();
    }
  }

  private unlinkAll(a: Uint64) {
    let unlinked = this.allSets.unlink(a);
    if (unlinked) {
      this.unlink_rpc(a);
    }
    return unlinked;
  }

  unlink (a: Uint64) {
    if (this.currentSets.unlink(a)) {
      // Unlink from all if in current
      this.unlinkAll(a);
      this.changed.dispatch();
    }
  }

  private splitAll(a: Uint64[], b: Uint64[]) {
    let split = this.allSets.split(a, b);
    if (split) {
      this.split_rpc(a, b);
    }
    return split;
  }

  split(a: Uint64[], b: Uint64[]) {
    if (this.currentSets.split(a, b)) {
      // Split in all if split in current
      this.splitAll(a, b);
      this.changed.dispatch();
    }
  }

  setElements(a: Uint64) {
    return this.allSets.setElements(a);
  }

  get size() {
    return this.allSets.size;
  }

  toJSON() {
    return this.currentSets.toJSON();
  }

  addSets(linker: (a: Uint64, b: Uint64) => void, obj: any) {
    if (obj !== undefined) {
      let ids = [new Uint64(), new Uint64()];
      parseArray(obj, z => {
        parseArray(z, (s, index) => {
          let prev = (index - 1) % 2;
          let next = index % 2;
          // Parse the next item to join
          ids[next].parseString(String(s), 10);
          if (index !== 0) {
            // Link either current or saved elements
            linker.call(this, ids[prev], ids[next]);
          }
        });
      });
    }
  }

  // Restores current sets
  restoreState(obj: any) {
    // Clear only current
    this.clear();
    // Restore current
    this.addSets(this.link, obj);
  }

  // Restores saved sets
  restoreSaved(obj: any) {
    // Clear only saved
    this.clearSaved();
    // Link to save or split from current
    this.addSets(this.linkSaved, obj);
  }

  private clear_rpc() {
    let {rpc} = this;
    if (rpc) {
      rpc.invoke(CLEAR_METHOD_ID, {'id': this.rpcId});
    }
  }

  private link_rpc(a: Uint64, b: Uint64) {
    let {rpc} = this;
    if (rpc) {
      rpc.invoke(
          ADD_METHOD_ID,
          {'id': this.rpcId, 'al': a.low, 'ah': a.high, 'bl': b.low, 'bh': b.high});
    }
  }

  private unlink_rpc(a: Uint64) {
    let {rpc} = this;
    if (rpc) {
      rpc.invoke(
          REMOVE_METHOD_ID,
          {'id': this.rpcId, 'al': a.low, 'ah': a.high});
    }
  }

  private split_rpc(a: Uint64[], b: Uint64[]) {
    let {rpc} = this;
    if (rpc) {
      const xfer_a = Uint64.encodeUint32Array(a);
      const xfer_b = Uint64.encodeUint32Array(b);

      rpc.invoke(
          SPLIT_METHOD_ID,
          { 
            id: this.rpcId, 
            a: xfer_a,
            b: xfer_b,
          }, 
          [xfer_a.buffer, xfer_b.buffer]
      );
    }
  }
}

const tempA = new Uint64();
const tempB = new Uint64();

registerRPC(ADD_METHOD_ID, function(x) {
  let obj = <SharedDisjointUint64Sets>this.get(x['id']);
  tempA.low = x['al'];
  tempA.high = x['ah'];
  tempB.low = x['bl'];
  tempB.high = x['bh'];
  if (obj.allSets.link(tempA, tempB)) {
    obj.changed.dispatch();
  }
});

registerRPC(REMOVE_METHOD_ID, function(x) {
  let obj = <SharedDisjointUint64Sets>this.get(x['id']);
  tempA.low = x['al'];
  tempA.high = x['ah'];

  if (obj.allSets.unlink(tempA)) {
    obj.changed.dispatch();
  }
});

registerRPC(CLEAR_METHOD_ID, function(x) {
  let obj = <SharedDisjointUint64Sets>this.get(x['id']);
  if (obj.allSets.clear()) {
    obj.changed.dispatch();
  }
});

registerRPC(SPLIT_METHOD_ID, function (x) {
  const obj = <SharedDisjointUint64Sets>this.get(x['id']);
  
  const split_group_a = Uint64.decodeUint32Array(x.a);
  const split_group_b = Uint64.decodeUint32Array(x.b);

  if (obj.allSets.split(split_group_a, split_group_b)) {
    obj.changed.dispatch();
  }
});
