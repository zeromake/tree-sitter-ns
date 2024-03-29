// , 分割的重复效果 [1,2,3], [1]
function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)))
}

// , 分割的重复效果，但是不是必须的，可以支持类似 [1,2,3], []
function commaSep(rule) {
  return optional(commaSep1(rule))
}

const PREC = {
  primary: 7,
  unary: 6,
  multiplicative: 5,
  additive: 4,
  comparative: 3,
  and: 2,
  or: 1,
};

const multiplicative_operators = ['*', '/', 'mod'];
const additive_operators = ['+', '-'];
const comparative_operators = ['==', '=', '!=', '<', '<=', '>', '>=', '<>'];

const hexDigit = /[0-9a-fA-F]/;
const decimalDigit = /[0-9]/;

const decimalDigits = seq(decimalDigit, repeat(decimalDigit));
const hexDigits = seq(hexDigit, repeat(hexDigit));

const decimalLiteral = choice('0', seq(/[1-9]/, optional(decimalDigits)));
const hexLiteral = seq('0', choice('x', 'X'), hexDigits);
const intLiteral = choice(decimalLiteral, hexLiteral);

module.exports = grammar({
  name: "ns",
  extras: $ => [/\s/],
  rules: {
    document: $ => repeat(
      choice(
        $.comment,
        $.if_expression,
        $.else_expression,
        $.command,
        $.label,
        // 使用变量渲染文本
        $.variable,
        $.array_item_expr
      )
    ),
    _expression: $ => choice(
      $.unary_expression,
      $.binary_expression,
      $.int_literal,
    ),
    int_literal: _ => token(intLiteral),
    unary_expression: $ => prec(PREC.unary, seq(
      field('operator', choice('+', '-')),
      field('operand', $._expression),
    )),
    binary_expression: $ => {
      const table = [
        [PREC.multiplicative, choice(...multiplicative_operators)],
        [PREC.additive, choice(...additive_operators)],
        [PREC.comparative, choice(...comparative_operators)],
        [PREC.and, '&&'],
        [PREC.or, '||'],
      ];
      return choice(...table.map(([precedence, operator]) => {
        return prec.left(precedence, seq(
          field('left', $._expression),
          field('operator', operator),
          field('right', $._expression),
        ));
      }));
    },
    // 注释
    comment: $ => seq(/;.*/),
    // 常规变量名
    variable_name: $ => seq(/[a-zA-Z]/, /[0-9a-zA-Z_-]+/),
    // 标签
    label: $ => seq('*', $.variable_name),
    integer_expression: $ => prec.left(3, choice(
      $.integer,
      $.raw_integer_variable,
      $.array_item_expr,
      $.raw_array_variable,
      $.integer_calc
    )),
    // 使用 int 生成其它变量
    integer_calc: $ => {
      const one_expression = [];
      for ([operator, r] of [
        ['+', 1],
        ['-', 1],
        ['*', 2],
        ['/', 2],
        ['mod', 2]
      ]) {
        one_expression.push(prec.left(r, (seq(
            field('left', $.integer_expression),
            field('op', operator),
            field('right', $.integer_expression),
        ))));
      }
      return choice(...one_expression);
    },
    integer_calc_variable: $ => seq('%(', $.integer_calc, ')'),
    string_calc_variable: $ => seq('$(', $.integer_calc, ')'),
    array_calc_variable: $ => seq('?(', $.integer_calc, ')'),
    // 三种变量
    raw_integer_variable: $ => seq('%', choice($.integer, $.variable_name)),
    raw_string_variable: $ => seq('$', choice($.integer, $.variable_name)),
    raw_array_variable: $ => seq('?', choice($.integer, $.variable_name)),
    connect_string: $ => {
      const left_expression = choice($.string, $.string_variable);
      return prec.left(1, seq(left_expression, repeat1(seq('+', left_expression))));
    },
    string_variable: $ => choice($.raw_string_variable, $.string_calc_variable),
    integer_variable: $ => prec.left(2, choice($.raw_integer_variable, $.integer_calc_variable, $.integer_calc)),
    array_variable: $ => choice($.raw_array_variable, $.array_calc_variable),
    // int string array 变量
    variable: $ => choice($.string_variable, $.integer_variable, $.array_variable),
    // 数组下标
    array_item_expr: $ => seq($.array_variable, repeat1(seq('[', $.integer, ']'))),
    // 字符串表达式
    string: $ => choice(seq('"', '"'), seq('"', $.string_content, '"')),
    string_content: $ => repeat1(choice(
      token.immediate(prec(1, /[^"\n]+/))
    )),
    // 数字表达式
    integer: $ => {
      const decimal_digits = /\d+/;
      const decimal_integer = seq(
        optional(choice('-', '+')),
        choice(
          '0',
          seq(/[1-9]/, optional(decimal_digits))
        )
      );
      return token(decimal_integer);
    },
    // hex 颜色
    hex_color: $ => {
      return seq('#', choice(/[0-9a-fA-F]{3}/, /[0-9a-fA-F]{4}/, /[0-9a-fA-F]{6}/, /[0-9a-fA-F]{8}/))
    },
    // 参数表达式
    expression: $ => choice(
      $.connect_string,
      $.variable,
      $.integer,
      $.string,
      $.array_item_expr,
      $.variable_name,
      $.label,
      $.hex_color
    ),
    if_expression: $ => {
      const integer_if_expression = choice($.variable, $.integer, $.string);
      const op_if_expression = choice('<>', '>', '<', '>=', '<=', '==', '=', '!=');
      const if_expression_one = seq(integer_if_expression, op_if_expression, integer_if_expression);
      // 把表达式内嵌到 if 语句里
      return prec.right(1, seq(
        choice('if', 'notif', 'elseif', 'elif'),
        ' ',
        if_expression_one,
        repeat(seq(choice('||', '&&'), if_expression_one)),
        optional($.command),
      ));
    },
    else_expression: $ => prec.right(1, seq('else', optional(seq(' ', $.command)))),
    // 命令语句
    command: $ => prec.right(1, seq(
      field("command", $.variable_name),
      prec.left(
        1,
        optional(
          choice(
            // 字符串表达式在最前面可以不用空格分割
            seq($.string, optional(seq(',', commaSep1(
              field("param", $.expression)
            )))),
            // 正常使用空格分割的参数
            seq(' ', commaSep1(
              field("param", $.expression)
            )),
          ),
        )
      ),
    ))
  }
});

