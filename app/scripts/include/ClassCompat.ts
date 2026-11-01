/*
    Copyright 2016 Sony Corporation

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

/**
 * ES5 向けに出力していた頃の class の挙動を再現する。
 *
 * ES5 の出力では、class のメソッドとアクセサー (get/set) は prototype の列挙可能なプロパティだった。
 * アプリは $.extend(true, {}, model) や for...in でモデルを複製・走査しており、
 * prototype のアクセサー (path など) やメソッドがコピーされることを前提としている。
 * ネイティブの class ではこれらが列挙不可になるため、読み込んだ class の prototype を列挙可能にする。
 */
namespace Garage {
    export namespace ClassCompat {

        const processed = new WeakSet<object>();

        function makePrototypeEnumerable(ctor: Function): void {
            let prototype = ctor.prototype;
            if (!prototype || processed.has(prototype)) {
                return;
            }
            processed.add(prototype);
            for (let name of Object.getOwnPropertyNames(prototype)) {
                if (name === "constructor") {
                    continue;
                }
                let descriptor = Object.getOwnPropertyDescriptor(prototype, name);
                if (descriptor && !descriptor.enumerable && descriptor.configurable) {
                    descriptor.enumerable = true;
                    Object.defineProperty(prototype, name, descriptor);
                }
            }
        }

        function walk(namespace: any, visited: Set<any>): void {
            if (visited.has(namespace)) {
                return;
            }
            visited.add(namespace);
            for (let key of Object.keys(namespace)) {
                let value = namespace[key];
                if (typeof value === "function") {
                    makePrototypeEnumerable(value);
                } else if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
                    // namespace (Garage.Model, Garage.View.Dialog など) をたどる
                    walk(value, visited);
                }
            }
        }

        /**
         * Garage 以下で読み込み済みの class の prototype を列挙可能にする。
         * class を含むスクリプトを読み込んだ後に呼び出す (複数回呼び出してよい)。
         */
        export function apply(): void {
            walk(Garage, new Set<any>());
        }
    }
}
