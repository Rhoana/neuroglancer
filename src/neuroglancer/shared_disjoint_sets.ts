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

  linkSaved(a: Uint64, b: Uint64) {
    // Saved links go to full group
    this.allSets.link(a,b);
    this.changed.dispatch();
  }

  link(a: Uint64, b: Uint64) {
    // New links go to both groups
    this.allSets.link(a,b);
    if (this.currentSets.link(a, b)) {
      let {rpc} = this;
      if (rpc) {
        rpc.invoke(
            ADD_METHOD_ID,
            {'id': this.rpcId, 'al': a.low, 'ah': a.high, 'bl': b.low, 'bh': b.high});
      }
      this.changed.dispatch();
    }
  }

  get(x: Uint64): Uint64 {
    return this.allSets.get(x);
  }

  clearSaved() {
    // Only current sets
    this.allSets.clear();
    this.addSets(this.linkSaved, this.toJSON());
  }

  clearAll() {
    // Clear all sets everywhere
    this.allSets.clear();
    if (this.currentSets.clear()) {
      let {rpc} = this;
      if (rpc) {
        rpc.invoke(CLEAR_METHOD_ID, {'id': this.rpcId});
      }
      this.changed.dispatch();
    }
  }

  unlink (a: Uint64) {
    // Unlink from both groups
    this.allSets.unlink(a);
    if (this.currentSets.unlink(a)) {
      let {rpc} = this;
      if (rpc) {
        rpc.invoke(
            REMOVE_METHOD_ID,
            {'id': this.rpcId, 'al': a.low, 'ah': a.high});
      }
      this.changed.dispatch();
    }
  }

  split(a: Uint64[], b: Uint64[]) {
    // Split in both groups
    this.currentSets.split(a, b);
    if (this.currentSets.split(a, b)) {
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
          ids[index % 2].parseString(String(s), 10);
          if (index !== 0) {
            // Link either current or saved elements
            linker.call(this, ids[0], ids[1]);
          }
        });
      });
    }
  }

  // Restores current sets
  restoreState(obj: any) {
    this.clearAll();
    this.addSets(this.link, obj);
  }
  // Restores saved sets
  restoreSaved(obj: any) {
    this.clearSaved();
    this.addSets(this.linkSaved, obj);
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
  if (obj.currentSets.link(tempA, tempB)) {
    obj.changed.dispatch();
  }
});

registerRPC(REMOVE_METHOD_ID, function(x) {
  let obj = <SharedDisjointUint64Sets>this.get(x['id']);
  tempA.low = x['al'];
  tempA.high = x['ah'];

  if (obj.currentSets.unlink(tempA)) {
    obj.changed.dispatch();
  }
});

registerRPC(CLEAR_METHOD_ID, function(x) {
  let obj = <SharedDisjointUint64Sets>this.get(x['id']);
  if (obj.currentSets.clear()) {
    obj.changed.dispatch();
  }
});

registerRPC(SPLIT_METHOD_ID, function (x) {
  const obj = <SharedDisjointUint64Sets>this.get(x['id']);
  
  const split_group_a = Uint64.decodeUint32Array(x.a);
  const split_group_b = Uint64.decodeUint32Array(x.b);

  if (obj.currentSets.split(split_group_a, split_group_b)) {
    obj.changed.dispatch();
  }
});
