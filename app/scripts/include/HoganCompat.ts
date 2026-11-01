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
 * require.js module "hogan"
 *
 * cdp.tools の Template.getJST() は、グローバルの Hogan があれば Hogan.compile(template).render(data) を使用する。
 * 保守が終了した hogan.js の代わりに、同じ Mustache 記法を処理する mustache.js でこの API を提供する。
 */
define(["mustache"], (Mustache: any) => {
    let Hogan = {
        compile: (template: string) => {
            Mustache.parse(template);
            return {
                render: (view: any, partials?: any): string => Mustache.render(template, view, partials),
            };
        },
    };
    (<any>window).Hogan = Hogan;
    return Hogan;
});
