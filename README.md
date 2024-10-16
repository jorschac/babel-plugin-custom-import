# babel-plugin-custom-import

continuation of [umijs/babel-plugin-import](https://github.com/umijs/babel-plugin-import#customName), which no longer accept PRs

See below for new changes


Modular import plugin for babel, compatible with [antd](https://github.com/ant-design/ant-design), [antd-mobile](https://github.com/ant-design/ant-design-mobile), lodash, [material-ui](http://material-ui.com/), and so on.


## Why babel-plugin-import?

- [English Instruction](https://ant.design/docs/react/getting-started#Import-on-Demand)
- [中文说明](https://ant.design/docs/react/getting-started-cn#%E6%8C%89%E9%9C%80%E5%8A%A0%E8%BD%BD)

## Why babel-plugin-custom-import?
 Besides on-demand import, babel-plugin-custom-import allows you to **customize** your library/npm package name when you import it. 


 This is particularly helpful when you work as a indie programmer or work for a small team, where you want to modify your package name as well as use that nice 'on-demand-import' feature in your own project while the original babel-plugin-import isn't compatible with. 


 A practical example could be shortening import source. Imagine due to team regulations you have to have a very wordy package name ``@team_prefix/blah-cli-name1-utils``


 you definitely don't want other engineer in your team to import things from that name. Using **babel-plugin-custom-import** could help you shorten that name


 e.g.


 ```js
 import DefaultImport, {NamedImport} from 'name1-utils'
 ```

 could be 'transpiled' to:

 ```js
 import DefaultImport, {NamedImport} from '@team_prefix/blah-cli-name1-utils'
 ```

How to do this? See changelog below

 
  

## Where to add babel-plugin-custom-import

- [babelrc](https://babeljs.io/docs/usage/babelrc/)
- [babel-loader](https://github.com/babel/babel-loader)

## Changelog



### Note

babel-plugin-import will not work properly if you add the library to the webpack config [vendor](https://webpack.js.org/concepts/entry-points/#separate-app-and-vendor-entries).
