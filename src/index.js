import assert from 'assert';
import Plugin from './Plugin';

/**
 * 
 * @param {*} param0 
 * @returns - {visitor: 
 * {
 *  programm: {enter(){}, exit(){}}}, 
 *  [method: string]: Function
 * }
 */
export default function ({ types }) {
  let plugins = null;

  // Only for test
  // eslint-disable-next-line no-underscore-dangle
  global.__clearBabelAntdPlugin = () => {
    plugins = null;
  };

  /**
   * 以plugins中的单个实例为上下文执行method方法，传参是[...args, context]
   * @param {*} method 
   * @param {*} args 
   * @param {*} context 
   */
  function applyInstance(method, args, context) {
    // eslint-disable-next-line no-restricted-syntax
    for (const plugin of plugins) {
      if (plugin[method]) {
        plugin[method].apply(plugin, [...args, context]);
      }
    }
  }

  const Program = {
    /**
     * 进入初始化生命周期时，创建Plugins实例
     * opts是配置
     * 如果 opts 是数组，则为每个配置项创建一个插件实例。
     * 否则，为单个配置项创建一个插件实例。
     * @param {*} path 
     * @param {*} param1 
     */
    enter(path, { opts = {} }) {
      // Init plugin instances once.
      if (!plugins) {
        if (Array.isArray(opts)) {
          plugins = opts.map(
            (
              {
                libraryName,
                libraryDirectory,
                style,
                styleLibraryDirectory,
                customStyleName,
                camel2DashComponentName,
                camel2UnderlineComponentName,
                fileName,
                customName,
                transformToDefaultImport,
                alias,
                transferNameOn,
              },
              index,
            ) => {
              assert(libraryName, 'libraryName should be provided');
              if (!types) {
                throw new Error('types不存在!', { types });
              }
              return new Plugin({
                libraryName,
                libraryDirectory,
                style,
                styleLibraryDirectory,
                customStyleName,
                camel2DashComponentName,
                camel2UnderlineComponentName,
                fileName,
                customName,
                transformToDefaultImport,
                alias,
                transferNameOn,
                types,
                index,
              });
            },
          );
        } else {
          assert(opts.libraryName, 'libraryName should be provided');
          plugins = [
            new Plugin({
              libraryName: opts.libraryName,
              libraryDirectory: opts.libraryDirectory,
              style: opts.style,
              styleLibraryDirectory: opts.styleLibraryDirectory,
              customStyleName: opts.customStyleName,
              camel2DashComponentName: opts.camel2DashComponentName,
              camel2UnderlineComponentName: opts.camel2UnderlineComponentName,
              fileName: opts.fileName,
              customName: opts.customName,
              transformToDefaultImport: opts.transformToDefaultImport,
              alias: opts.alias,
              transferNameOn: opts.transferNameOn,
              types,
              index: 0,
            }),
          ];
        }
      }
      applyInstance('ProgramEnter', arguments, this); // eslint-disable-line
    },
    exit() {
      applyInstance('ProgramExit', arguments, this); // eslint-disable-line
    },
  };

  const methods = [
    'ImportDeclaration',
    'CallExpression',
    'MemberExpression',
    'Property',
    'VariableDeclarator',
    'ArrayExpression',
    'LogicalExpression',
    'ConditionalExpression',
    'IfStatement',
    'ExpressionStatement',
    'ReturnStatement',
    'ExportDefaultDeclaration',
    'BinaryExpression',
    'NewExpression',
    'ClassDeclaration',
    'SwitchStatement',
    'SwitchCase',
    'SequenceExpression',
  ];

  const ret = {
    visitor: { Program },
  };

  // eslint-disable-next-line no-restricted-syntax
  for (const method of methods) {
    ret.visitor[method] = function () {
      // eslint-disable-line
      applyInstance(method, arguments, ret.visitor); // eslint-disable-line
    };
  }

  return ret;
}

